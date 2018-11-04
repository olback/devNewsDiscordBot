import * as fs from 'fs';
import { env } from 'process';
import * as dotenv from 'dotenv';
import * as Discord from 'discord.js';
import * as devRant from 'rantscript';
import * as lowdb from 'lowdb';
import * as FileSync from 'lowdb/adapters/FileSync';
import * as download from 'download-to-file';
import { Notifications } from './notifications';

dotenv.load({ path: '.env' }); // Load .env

const cmdPrefix = env.COMMAND_PREFIX || '!';
const client = new Discord.Client();

if (!fs.existsSync('./temp')) {
	fs.mkdirSync('./temp');
}

const adapter = new FileSync('db.json');
const db = lowdb(adapter);

db.defaults({ users: [], queue: [] })
  .write();

var devRantToken: object = {};
var notifications: Notifications;

function helpText (queue) {
	return {embed: {
		title: "devNews-Bot Command Help",
		description: "**Writing a post:**\nWrite your posts in #draft. The bot won't disturb you there and also you can edit everything before posting!\n\n**Publishing a post:**\nTo publish a post, copy/paste everything in the correct order from #draft to #releases. The bot should send some feedback. (If not contact @Skayo)",
		color: 14962512,
		fields: [
			{
				name: cmdPrefix + "help",
				value: "Show this message."
			},
			{
				name: cmdPrefix + "publish",
				value: "Add the current post to the release-queue. Afterwards it will be published to devRant as soon as possible! (The post can't be edited after you execute this command)"
			},
			{
				name: cmdPrefix + "image",
				value: "Attach an image to your current post. Can also be a GIF."
			},
			{
				name: cmdPrefix + "tags <tag1>, <tag2>, <...>",
				value: "Add some tags to your current post. Example: `!tags github, feature, this is a tag`"
			},
			{
				name: cmdPrefix + "reset",
				value: "Delete your current post. Removes all text, images and tags."
			},
			{
				name: cmdPrefix + "length",
				value: "Show the amount of posts in the release-queue."
			},
			{
				name: cmdPrefix + "show <n | current>",
				value: "Show a post in the release-queue or the current one."
			},
			{
				name: cmdPrefix + "signature <signature text>",
				value: "Set your own signature that gets posted as a comment on every of your posts. (Use 'u:' instead of '@' if you want to mention a devRant user)"
			}
		],
		footer: {
			text: `Try-to-post frequenzy: ${env.POST_FREQUENCY || 10} | Posts in release-queue: ${queue.length} (max: 10)`
		}
	}};
}


client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

client.on('rateLimit', () => {
	console.log('Well, shit...');
});

/*
client.on('messageUpdate', (_msg, newMsg) => {

	//console.log(msg.id, newMsg.id);
	//console.log('Edit:', newMsg.content);


	if (lastPost && lastPost.msg.author.id === newMsg.id) {
		lastPost.msg = newMsg;
	}

});
*/

client.on('message', msg => {

	if (msg.channel.id === env.RELEASE_CHANNEL_ID) {

		if (msg.author.bot || msg.content.startsWith('!-')) {
			// If message posted by bot or if it starts with '!-', then ignore it
			return;
		}

		if (msg.content.toLowerCase().startsWith(cmdPrefix)) {

			let message = msg.content.substr(cmdPrefix.length); // Remove command prefix from message
			let msgParts = message.split(' ');

			// Handle commands here
			const cmd = msgParts[0];
			const args = msgParts.splice(1);
			const rawArgs = message.substr(cmd.length).trim(); // All arguments but not split

			command(cmd, args, rawArgs, msg);

		} else {

			if (msg.content.length >= Number(env.MIN_POST_LENGTH) && msg.content.length <= Number(env.MAX_POST_LENGTH)) {

				const user = getUser(msg);

				if (user.newPost.text == '') {
					db.get('users')
					  .find({ id: user.id })
					  .set('newPost.text', msg.content)
					  .write();

					msg.reply(`new post created!\nAdd tags with \`${cmdPrefix}tags <tag1>, <tag2>, <...>\`\nAttach an image with \`${cmdPrefix}image\`\nPost to devRant with \`${cmdPrefix}publish\``);
				} else {
					db.get('users')
					  .find({ id: user.id })
					  .set('newPost.text', user.newPost.text + '\n\n' + msg.content)
					  .write();

					msg.reply('added text to your current post.');
				}

			} else { // Else, respond with error

				if (msg.content.length >= Number(env.MIN_POST_LENGTH)) {
					msg.reply('this post seems a little long.');
				} else {
					msg.reply('this post seems a little short.');
				}

			}

		}

	}

});

function getUser (msg) {
	let user = db
		.get('users')
		.find({ id: msg.author.id })
		.value();

	if (user === undefined) {
		user = {
			id:        msg.author.id,
			signature: '',
			newPost:   {
				text:  '',
				image: '',
				tags:  []
			}
		};

		db.get('users')
		  .push(user)
		  .write();
	}

	return user;
}

function clearPost (user) {
	db.get('users')
	  .find({ id: user.id })
	  .assign({
		  newPost: {
			  text:  '',
			  image: '',
			  tags:  []
		  }
	  })
	  .write();
}

function command (cmd: string, args: string[], rawArgs: string, msg: Discord.Message) {
	const user = getUser(msg);
	const queue = db.get('queue').value();

	switch (cmd) {
		case 'publish':
			if (queue.length > 10) {
				msg.reply('you may not add more posts right now.\nThere are already 10 scheduled for release.');
				return;
			}

			if (user.newPost.text != '') {
				user.newPost.userID = user.id; // Add user ID to newPost so we know who made this post once in the queue

				db.get('queue')
				  .push(user.newPost)
				  .write();

				msg.reply(`"${user.newPost.text.substring(0, 15)}..." has been added to the release-queue.`);

				clearPost(user);

				tryPost(); // Try to post it
			} else {
				msg.reply('you don\'t have a post to publish.');
			}
			break;

		case 'length':
			msg.reply(`there are currently **${queue.length}** post(s) waiting to be published to devRant.`);
			break;

		case 'show':
			if (args[0] === 'current' && user.newPost.text != '') {

				msg.reply(`as requested, here is your current post:\n\`\`\`${user.newPost.text}\n------\nTags: ${user.newPost.tags.join(', ')}\nImage: ${user.newPost.image}\`\`\``);

			} else {
				const post = queue[Number(args[0]) - 1];

				if (post) {
					client.fetchUser(post.userID).then(user => {
						msg.reply(`as requested, here is post #${Number(args[0])}:\n\`\`\`${post.text}\n------\nAuthor: @${user.username}\nTags: ${post.tags.join(', ')}\nImage: ${post.image}\`\`\``);
					});
				} else {
					msg.reply('post does not exist.');
				}

			}
			break;

		case 'tags':
			if (user.newPost.text != '') {
				const newTags = rawArgs.split(',').map(t => t.trim());

				db.get('users')
				  .find({ id: user.id })
				  .set('newPost.tags', newTags)
				  .write();

				msg.reply(`added tags: \`${newTags.join(', ')}\``);
			} else {
				msg.reply('there is no post to add tags to.');
			}
			break;

		case 'image':
			if (user.newPost.text != '') {
				if (msg.attachments.array().length > 0) {
					console.log(msg.attachments.array()[0].url);

					db.get('users')
					  .find({ id: user.id })
					  .set('newPost.image', msg.attachments.array()[0].url)
					  .write();

					msg.reply('attached image.');
				} else {
					msg.reply('no image attatched.');
				}
			} else {
				msg.reply('there is no post to attach the image to.');
			}
			break;

		case 'reset':
			clearPost(user);

			msg.reply('current post deleted.');
			break;

		case 'signature':
			let newSignature = rawArgs;

			if (newSignature != '') {
				// To use your devRant username in signature, prefix with u: instead of @
				newSignature = newSignature.replace('u:', '@');

				db.get('users')
				  .find({ id: user.id })
				  .set('signature', newSignature)
				  .write();

				msg.reply(`set signature to:\n\`\`\`${newSignature}\`\`\``);
			} else {
				if (user.signature != '') {
					msg.reply(`your current signature:\n\`\`\`${user.signature}\`\`\``);
				} else {
					msg.reply('you didn\'t set a signature yet!');
				}
			}
			break;

		case 'help':
			if (!msg.author.dmChannel) {
				msg.author.createDM().then((dmChannel) => {
					dmChannel.send(helpText(queue));
				});
			} else {
				msg.author.dmChannel.send(helpText(queue));
			}
			break;

		default:
			msg.reply(`Unknown command. \`${cmdPrefix}help\` for a list of available commands.`);

	}
}

function tryPost () {
	const queue = db.get('queue').value();

	if (queue.length > 0) {
		const post = queue[0];

		const channel: Discord.TextChannel = client.channels.get(env.RELEASE_CHANNEL_ID || '');

		if (channel === undefined) {
			console.error('Channel with ID ' + env.RELEASE_CHANNEL_ID + ' not found. Please check!');
			return;
		}

		const postRant = function (filePath = false) {
			// Post rant
			devRant.postRant(
				post.text,
				post.tags.join(', '),
				Number(env.DEVRANT_POST_CATEGORY || 6),
				devRantToken,
				(filePath || null)
			).then(postData => {
				if (postData.success) {
					// Delete post in queue
					db.get('queue')
					  .shift()
					  .write();

					channel.send(`Posted article to devRant!\nLink: https://devrant.com/rants/${postData.rant_id}`)
					       .catch(console.error);

					postSignature(post.userID, postData.rant_id);
				} else if (!postData.error.startsWith('Right now you can only add')) {
					db.get('queue')
					  .shift()
					  .write();

					channel.send('Something went wrong while posting to devRant:\n```\n' + postData.error + '\n```\nPost got removed from the release-queue. Please publish it again!')
					       .catch(console.error);
				}

			}).catch(console.error);
		};

		if (post.image != '') {
			downloadFile(post.image, post.userID, function (err, filePath) {
				if (err) console.error(err);

				postRant(filePath);
			});
		} else {
			postRant();
		}


	}
}

// Download a file and return it's local file path
function downloadFile (url, userID, callback) {
	if (url == '') {
		return false;
	}

	const fileExtension = url.split('.').pop().toLowerCase();
	const filePath = './temp/' + userID + '.' + fileExtension;

	if (!['png', 'jpg', 'jpeg', 'gif'].includes(fileExtension)) {
		return false;
	}

	return download(url, filePath, callback);
}

function postSignature (userID, rantID) {
	const signature = db
		.get('users')
		.find({ id: userID })
		.get('signature')
		.value();

	devRant.postComment(signature, rantID, devRantToken)
	       .catch(console.error);
}

// Login to devRant and connect to Discord
devRant.login(
	String(env.DEVRANT_USERNAME),
	String(env.DEVRANT_PASSWORD)
).then(tokenData => {
	devRantToken = tokenData.auth_token;

	notifications = new Notifications(client, devRant, devRantToken, env.NOTIF_CHANNEL_ID);

	// Check for notifications
	setInterval(() => notifications.check(), Number(env.NOTIF_FREQUENCY || 10) * 1000);

	client.login(env.DISCORD_TOKEN)
	      .then(() => {
		      tryPost();

		      // Execute tryPost every x minutes
		      setInterval(tryPost, Number(env.POST_FREQUENCY || 10) * 60 * 1000);
	      })
	      .catch(console.error);
}).catch(() => {
	console.error('Unable to log-in to devRant! Please check username/password!');
});
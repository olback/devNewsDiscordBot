import { DMChannel, TextChannel } from 'discord.js';
import * as fs from 'fs';
import { env } from 'process';
import * as dotenv from 'dotenv';
import * as Discord from 'discord.js';
import * as devRant from 'rantscript';
import * as lowdb from 'lowdb';
import * as FileSync from 'lowdb/adapters/FileSync';
import * as download from 'download-to-file';
import { Notifications } from './notifications';
import { Welcomer } from './welcomer';

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
var welcomer: Welcomer;

function helpText (queue) {
	return {
		embed: {
			title:       'devNews-Bot Command Help',
			description: '**Writing a post:**\nWrite your posts in #draft. The bot won\'t disturb you there and also you can edit everything before posting!\n\n**Publishing a post:**\nTo publish a post, copy/paste everything in the correct order from #draft to #releases. The bot should send some feedback. (If not contact @Skayo)',
			color:       14962512,
			fields:      [
				{
					name:  cmdPrefix + 'help',
					value: 'Show this message.'
				},
				{
					name:  cmdPrefix + 'publish',
					value: 'Add the current post to the release-queue. Afterwards it will be published to devRant as soon as possible! (The post can\'t be edited after you execute this command)'
				},
				{
					name:  cmdPrefix + 'image',
					value: 'Attach an image to your current post. Can also be a GIF.'
				},
				{
					name:  cmdPrefix + 'tags <tag1>, <tag2>, <...>',
					value: 'Add some tags to your current post. Example: `!tags github, feature, this is a tag`'
				},
				{
					name:  cmdPrefix + 'reset',
					value: 'Delete your current post. Removes all text, images and tags.'
				},
				{
					name:  cmdPrefix + 'length',
					value: 'Show the amount of posts in the release-queue.'
				},
				{
					name:  cmdPrefix + 'show <n | current>',
					value: 'Show a post in the release-queue or the current one.'
				},
				{
					name:  cmdPrefix + 'signature <signature text>',
					value: 'Set your own signature that gets posted as a comment on every of your posts. (Use \'u:\' instead of \'@\' if you want to mention a devRant user)'
				},
				{
					name:  cmdPrefix + 'stats',
					value: 'Show statistics like how many posts you\'ve written or what your best article is.'
				}
			],
			footer:      {
				text: `Try-to-post frequenzy: ${env.POST_FREQUENCY || 10} | Posts in release-queue: ${queue.length} (max: 10)`
			}
		}
	};
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

function isReleaseChannel (msg) {
	return (msg.channel.id === env.RELEASE_CHANNEL_ID);
}

function reply (msg, text) {
	if (msg.channel instanceof TextChannel) {
		msg.reply(text);
	} else {
		msg.channel.send(text.charAt(0).toUpperCase() + text.slice(1));
	}
}

client.on('message', msg => {
	if (msg.type != 'DEFAULT') {
		// If message is for example a pin message, not a normal one, ignore it
		return;
	}

	if (msg.author.bot || msg.content.startsWith('!-')) {
		// If message posted by bot or if it starts with '!-', then ignore it
		return;
	}

	if (
		!client.guilds
		       .find(guild => guild.name === 'devNews')
		       .roles
		       .find(role => role.name === 'Author')
		       .members
		       .find(member => member.id === msg.author.id)
	) {
		// Only Authors are allowed to use the bot.
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

	} else if (isReleaseChannel(msg)) {

		if (msg.content.length >= Number(env.MIN_POST_LENGTH) && msg.content.length <= Number(env.MAX_POST_LENGTH)) {

			const user = getUser(msg);

			if (user.newPost.text == '') {
				db.get('users')
				  .find({ id: user.id })
				  .set('newPost.text', msg.content)
				  .write();

				reply(msg, `new post created!\nAdd tags with \`${cmdPrefix}tags <tag1>, <tag2>, <...>\`\nAttach an image with \`${cmdPrefix}image\`\nPost to devRant with \`${cmdPrefix}publish\``);
			} else {
				db.get('users')
				  .find({ id: user.id })
				  .set('newPost.text', user.newPost.text + '\n\n' + msg.content)
				  .write();

				reply(msg, 'added text to your current post.');
			}

		} else { // Else, respond with error

			if (msg.content.length >= Number(env.MIN_POST_LENGTH)) {
				reply(msg, 'this post seems a little long.');
			} else {
				reply(msg, 'this post seems a little short.');
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
			posts:     [],
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
			if (!isReleaseChannel(msg))
				return;

			if (queue.length > 10) {
				reply(msg, 'you may not add more posts right now.\nThere are already 10 scheduled for release.');
				return;
			}

			if (user.newPost.text != '') {
				if (user.newPost.text.length < 5000) {
					user.newPost.userID = user.id; // Add user ID to newPost so we know who made this post once in the queue

					db.get('queue')
					  .push(user.newPost)
					  .write();

					reply(msg, `"${user.newPost.text.substring(0, 15)}..." has been added to the release-queue.`);

					clearPost(user);

					tryPost(); // Try to post it
				} else {
					reply(msg, 'your post is longer than 5000 characters!\nPlease write to @Skayo to post it manually, or shorten it down!');
				}
			} else {
				reply(msg, 'you don\'t have a post to publish.');
			}
			break;

		case 'length':
			reply(msg, `there are currently **${queue.length}** post(s) waiting to be published to devRant.`);
			break;

		case 'show':
			if (args[0] === 'current' && user.newPost.text != '') {

				reply(msg, 'as requested, here is your current post:');
				msg.channel.send('```' + user.newPost.text + '```', { split: { prepend: '```', append: '```' } }).then(() => {
					msg.channel.send(`-------\n\`\`\`Tags: ${user.newPost.tags.join(', ')}\nImage: ${user.newPost.image}\nCharacters: ${user.newPost.text.length}\`\`\``);
				}).catch(console.error);
			} else {
				const post = queue[Number(args[0]) - 1];

				if (post) {
					client.fetchUser(post.userID).then(user => {
						reply(msg, `as requested, here is post #${Number(args[0])}:`);
						msg.channel.send('```' + post.text + '```', { split: { prepend: '```', append: '```' } }).then(() => {
							msg.channel.send(`-------\n\`\`\`Author: @${user.username}\nTags: ${post.tags.join(', ')}\nImage: ${post.image}\nCharacters: ${post.text.length}\`\`\``);
						}).catch(console.error);
					}).catch(console.error);
				} else {
					reply(msg, 'post does not exist.');
				}

			}
			break;

		case 'tags':
			if (!isReleaseChannel(msg))
				return;

			if (user.newPost.text != '') {
				const newTags = rawArgs.split(',').map(t => t.trim());

				db.get('users')
				  .find({ id: user.id })
				  .set('newPost.tags', newTags)
				  .write();

				reply(msg, `added tags: \`${newTags.join(', ')}\``);
			} else {
				reply(msg, 'there is no post to add tags to.');
			}
			break;

		case 'image':
			if (!isReleaseChannel(msg))
				return;

			if (user.newPost.text != '') {
				if (msg.attachments.array().length > 0) {
					console.log(msg.attachments.array()[0].url);

					db.get('users')
					  .find({ id: user.id })
					  .set('newPost.image', msg.attachments.array()[0].url)
					  .write();

					reply(msg, 'attached image.');
				} else {
					reply(msg, 'no image attatched.');
				}
			} else {
				reply(msg, 'there is no post to attach the image to.');
			}
			break;

		case 'reset':
			if (!isReleaseChannel(msg))
				return;

			clearPost(user);

			reply(msg, 'current post deleted.');
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

				reply(msg, `set signature to:\n\`\`\`${newSignature}\`\`\``);
			} else {
				if (user.signature != '') {
					reply(msg, `your current signature:\n\`\`\`${user.signature}\`\`\``);
				} else {
					reply(msg, 'you didn\'t set a signature yet!');
				}
			}
			break;

		case 'stats':
			getUserStats(user, stats => {
				if (stats.articlesCount > 0) {
					reply(msg, `here are your statistics:\n> **Articles written:** ${stats.articlesCount}\n> **Score of all your posts summed:** ${stats.scoreSum}++\n> **Your best article:** https://devrant.com/rants/${stats.bestPost.id}  *(${stats.bestPost.score}++'s)*\n> **Your "worst" article:** https://devrant.com/rants/${stats.worstPost.id}  *(${stats.worstPost.score}++'s)*`);
				} else {
					reply(msg, `here are your statistics:\n> **Articles written:** 0\n> **Score of all your posts summed:** 0\n> **Your best article:** -\n> **Your "worst" article:** -`);
				}
			});
			break;

		case 'help':
			if (!msg.author.dmChannel) {
				msg.author.createDM().then((dmChannel: DMChannel) => {
					dmChannel.send(helpText(queue));
				}).catch(console.error);
			} else {
				msg.author.dmChannel.send(helpText(queue));
			}
			break;

		default:
			reply(msg, `Unknown command. \`${cmdPrefix}help\` for a list of available commands.`);

	}
}

function getUserStats (user, callback) {
	const posts = user.posts;

	if (posts.length == 0) {
		callback({
			articlesCount: 0
		});
		return;
	}

	// Use search because there is no result limit
	devRant
		.search('devNews')
		.then(results => {
			let scoreSum = 0;
			let bestPost = {
				score: 0,
				id:    0
			};
			let worstPost = {
				score: -1,
				id:    0
			};

			results.forEach(rant => {
				if (posts.includes(rant.id)) {
					scoreSum += rant.score;

					if (rant.score > bestPost.score) {
						bestPost.score = rant.score;
						bestPost.id = rant.id;
					}

					if (rant.score < worstPost.score || worstPost.score == -1) {
						worstPost.score = rant.score;
						worstPost.id = rant.id;
					}

					posts.filter(rantID => rantID != rant.id); // Remove rant ID from list
				}
			});

			// Go through each remaining ID (there shouldn't be any)
			posts.forEach(rantID => {
				// Fetch rant and update stats
				devRant
					.rant(rantID)
					.then(rant => {
						scoreSum += rant.score;

						if (rant.score > bestPost.score) {
							bestPost.score = rant.score;
							bestPost.id = rant.id;
						}

						if (rant.score < worstPost.score || worstPost.score == -1) {
							worstPost.score = rant.score;
							worstPost.id = rant.id;
						}
					})
			});

			callback({
				articlesCount: posts.length,
				scoreSum,
				bestPost,
				worstPost
			});
		}).catch(console.error);
}

function tryPost () {
	const queue = db.get('queue').value();

	if (queue.length > 0) {
		const post = queue[0];

		// @ts-ignore
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

					db.get('users')
					  .find({ id: post.userID })
					  .get('posts')
					  .push(postData.rant_id)
					  .write();
				} else if (post.text.length > 5000) {
					db.get('queue')
					  .shift()
					  .write();

					channel.send('Post is longer than 5000 characters!\nPlease write to @Skayo to post it manually, or shorten it down!')
					       .catch(console.error);
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

	if (signature !== '') {
		devRant.postComment(signature, rantID, devRantToken)
		       .catch(console.error);
	}
}

// Login to devRant and connect to Discord
devRant.login(
	String(env.DEVRANT_USERNAME),
	String(env.DEVRANT_PASSWORD)
).then(tokenData => {
	devRantToken = tokenData.auth_token;

	notifications = new Notifications(client, devRant, devRantToken, env.NOTIF_CHANNEL_ID);
	welcomer = new Welcomer(client, env.WELCOME_CHANNEL_ID);

	// Check for notifications
	setInterval(() => notifications.check(), Number(env.NOTIF_FREQUENCY || 10) * 1000);

	// Listen for new members
	client.on('guildMemberAdd', member => welcomer.sendWelcomeMessage(member));

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
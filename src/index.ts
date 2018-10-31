import * as Discord from 'discord.js';
import { env } from 'process';
import * as dotenv from 'dotenv';
import * as rantscript from 'rantscript';
import * as lowdb from 'lowdb';
import * as FileSync from 'lowdb/adapters/FileSync';

interface Post {
	msg: Discord.Message;
	tags: string[];
	img: string;
}

dotenv.load({ path: '.env' }); // Load .env

const cmdPrefix = env.COMMAND_PREFIX || '!dnb';
const client = new Discord.Client();

const adapter = new FileSync('db.json');
const db = lowdb(adapter);

db.defaults({ users: [], queue: [] })
  .write();

function helpText (queue) {
	return `
**devNews Bot Commands Help:**
!publish - Add current article to the waitlist.
!length - The amount of unpublished news articles.
!show <n | current> - Show Article with index n-1 or the current one.
!tags <tag1> <tag2> <tags...> - Add tags to the current article.
!reset - Delete the current article. (text, tags)
!signature <signature ...> - Set your own signature that gets posted as a comment on every of your posts.
!help - Show this help message.

Re-try / Post frequency: ${env.POST_FREQUENCY || 10} minutes.
Articles in queue: ${queue.length} (max: 10).
`;
}

/*
function sendMessage(msg: string) {

    const channel = client.channels.get(env.RELEASE_CHANNEL_ID || '');

    if (channel) {
        // @ts-ignore
        channel.send(msg);
    }

}
*/


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
			const cmd = msgParts[ 0 ];
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

					msg.reply(`new post created!\nAdd tags with \`${cmdPrefix} tags <tag1> <tag2>...\`\nAttach an image with \`${cmdPrefix} image\`\nPost to devRant with \`${cmdPrefix} publish\``);
				} else {
					db.get('users')
					  .find({ id: user.id })
					  .set('newPost.text', user.newPost.text + "\n\n" + msg.content)
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

function getUser(msg) {
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

function clearPost(user) {
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
				msg.reply("you may not add more posts right now.\nThere are already 10 scheduled for release.");
				return;
			}

			if (user.newPost.text != '') {
				db.get('queue')
				  .push(user.newPost)
				  .write();

				msg.reply(`"${user.newPost.text.substring(0, 15)}..." has been added to the release-queue.`);

				clearPost(user);
			} else {
				msg.reply("you don't have a post to publish.");
			}
			break;

		case 'length':
			msg.reply(`there are currently **${queue.length}** post(s) waiting to be published to devRant.`);
			break;

		case 'show':
			if (args[ 0 ] === 'current' && user.newPost.text != '') {

				console.log(user.newPost.text);
				msg.reply(`as requested, here is your current post:\n\`\`\`${user.newPost.text}\n------\nTags: ${user.newPost.tags.join(', ')}\nImage: ${user.newPost.image}\`\`\``);

			} else {
				const post = queue[ Number(args[ 0 ]) - 1 ];

				if (post) {
					msg.reply(`as requested, here is post #${Number(args[ 0 ])}:\n\`\`\`${post.text}\n------\nTags: ${post.tags.join(', ')}\nImage: ${post.image}\`\`\``);
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
					console.log(msg.attachments.array()[ 0 ].url);

					db.get('users')
					  .find({ id: user.id })
					  .set('newPost.image', msg.attachments.array()[ 0 ].url)
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
			const newSignature = rawArgs;

			if (newSignature != '') {
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
			msg.reply(helpText(queue));
			break;

		default:
			msg.reply(`Unknown command. \`${cmdPrefix}help\` for more help.`);

	}

}

// Connect to discord
client.login(env.DISCORD_TOKEN)
      .catch(e => console.error(e));

// Set interval
console.log(`POST_FREQUENCY set to ${env.POST_FREQUENCY || 10} minutes.`);
setInterval(() => {
	const queue = db.get('queue').value();

	if (queue.length > 0) {

		const post = queue[ 0 ];
		console.log(post.text);

		// Get authentication token from devRant API
		// rantscript
		//     .login(String(env.DEVRANT_USERNAME), String(env.DEVRANT_PASSWORD))
		//     .then(response => {
		//         rantscript.postRant(
		//             post.msg.content,
		//             post.tags.join(','),
		//             Number(env.DEVRANT_POST_CATEGORY || 6),
		//             response.auth_token,
		//             null
		//         ).then(resp => {
		//             posts.shift();
		//             sendMessage(`Posted article to devRant! Rant ID: ${resp.rant_id}.`);
		//         }).catch(e => {
		//             console.error(e);
		//             sendMessage('Something went wrong when posting article to devRant!');
		//         });
		//     }).catch(e => {
		//         console.error(e);
		//         sendMessage('Something went wrong when posting article to devRant!');
		//     });

	}

}, Number(env.POST_FREQUENCY || 10) * 60 * 1000);

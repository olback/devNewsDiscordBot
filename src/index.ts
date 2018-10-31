import * as Discord from 'discord.js';
import { env } from 'process';
import * as dotenv from 'dotenv';
import * as rantscript from 'rantscript';

interface Post {
    msg: Discord.Message;
    tags: string[];
    img: string;
}

dotenv.load({ path: '.env' }); // Load .env
const cmdPrefix = env.COMMAND_PREFIX || '!dnb';
const client = new Discord.Client();
let posts: Post[] = [];
let lastPost: Post | null;

function helpText() {
    return `
**devNews Bot Commands Help:**
publish - Add current article to the waitlist.
length - The amount of unpublished news articles.
show <n | current> - Show Article with index n-1 or the current one.
tags <tag1> <tag2> <tags...> - Add tags to the current article.
reset - Delete the current article. (text, tags)
help - Show this help message.

Re-try / Post frequency: ${env.POST_FREQUENCY || 10} minutes.
Articles in queue: ${posts.length} (max: 10).
`;
}

function sendMessage(msg: string) {

    const channel = client.channels.get(env.RELEASE_CHANNEL_ID || '');

    if (channel) {
        // @ts-ignore
        channel.send(msg);
    }

}


client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('rateLimit', () => {
    console.log('Well, shit...');
});

client.on('messageUpdate', (_msg, newMsg) => {

    // console.log(msg.id, newMsg.id);
    // console.log('Edit:', newMsg.content);

    if (lastPost && lastPost.msg.id === newMsg.id) {
        lastPost.msg = newMsg;
    }

});

client.on('message', msg => {

    if (msg.channel.id === env.RELEASE_CHANNEL_ID) {

        if (msg.author.bot || msg.content.startsWith('!-')) {
            return;
        }

        if (msg.content.toLowerCase().startsWith(cmdPrefix)) {

            // Handle commands here
            const cmd = msg.content.split(' ')[1];
            const args = msg.content.split(' ').splice(2);

            command(cmd, args, msg);

        } else {

            if (msg.content.length >= Number(env.MIN_POST_LENGTH) && msg.content.length <= Number(env.MAX_POST_LENGTH)) {

                lastPost = {
                    msg: msg,
                    tags: [],
                    img: ''
                }

                msg.reply(`New article started.\nAdd tags with \`${cmdPrefix} tags <tag1> <tag2>...\`.\nPost to devRant with \`${cmdPrefix} add\``);

            } else { // Else, respond with error

                if (msg.content.length >= Number(env.MIN_POST_LENGTH)) {

                    msg.reply('This post seems a little long.');

                } else {

                    msg.reply('This post seems a little short.');

                }

            }

        }

    }

});

function command(cmd: string, args: string[], msg: Discord.Message) {

    switch (cmd) {

        case 'publish':
            if (posts.length > 10) {
                msg.reply('You may not add more articles right now. There are already 10 scheduled for release.');
                return;
            }

            if (lastPost) {
                posts.push(lastPost);
                msg.reply(`"${lastPost.msg.content.substring(0, 15)}..." has been added to the waitlist.`);
                lastPost = null;
            } else {
                msg.reply('No article to publish');
            }
            break;

        case 'length':
            msg.reply(`There are currently ${posts.length} news articles waiting to be posted to devRant.`);
            break;

        case 'show':
            if (args[0] === 'current' && lastPost) {

                console.log(lastPost.msg.content);
                msg.reply(`As requested, here is the current article:\n\`\`\`${lastPost.msg.content}\n\nTags: ${lastPost.tags.join(', ')}\nImage: ${lastPost.img}\`\`\``)

            } else {

                const post = posts[Number(args[0]) - 1];
                if (post) {
                    msg.reply(`As requested, here is article ${Number(args[0])}:\n\`\`\`${post.msg.content}\n\nTags: ${post.tags.join(', ')}\nImage: ${post.img}\`\`\``);
                } else {
                    msg.reply('Article does not exist.');
                }

            }
            break;

        case 'tags':
            if (lastPost) {
                lastPost.tags = args.filter(t => t.trim()).map(t => t.replace(',', ''));
                msg.reply(`Added tags: ${lastPost.tags.join(', ')}.`);
            } else {
                msg.reply('Article does not exist.');
            }
            break;

        case 'image':
            if (lastPost) {
                if (msg.attachments.array().length > 0) {
                    console.log(msg.attachments.array()[0].url);
                    lastPost.img = msg.attachments.array()[0].url;
                    console.log(lastPost.img);
                    msg.reply('Image attatched');
                } else {
                    msg.reply('No image attatched.');
                }
            } else {
                msg.reply('Article does not exist.');
            }
            break;

        case 'reset':
            lastPost = null;
            msg.reply('Current article deleted.');
            break;

        case 'help':
            msg.reply(helpText());
            break

        default:
            msg.reply(`Unknown command. \`${cmdPrefix} help\` for more help.`);

    }

}

// Connect to discord
client.login(env.DISCORD_TOKEN)
    .catch(e => console.error(e));

// Set interval
console.log(`POST_FREQUENCY set to ${env.POST_FREQUENCY || 10} minutes.`);
setInterval(() => {

    if (posts.length > 0) {

        const post = posts[0];
        console.log(post.msg.content);

        // Get authentication token from devRant API
        // rantscript
        //     .login(String(env.DEVRANT_USENAME), String(env.DEVRANT_PASSWORD))
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

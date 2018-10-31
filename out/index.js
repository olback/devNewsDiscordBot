"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Discord = require("discord.js");
var process_1 = require("process");
var dotenv = require("dotenv");
var rantscript = require("rantscript");
dotenv.load({ path: '.env' }); // Load .env
var cmdPrefix = process_1.env.COMMAND_PREFIX || '!dnb';
var client = new Discord.Client();
var posts = [];
var lastPost;
function helpText() {
    return "\n**devNews Bot Commands Help:**\npublish - Add current article to the waitlist.\nlength - The amount of unpublished news articles.\nshow <n | current> - Show Article with index n-1 or the current one.\ntags <tag1> <tag2> <tags...> - Add tags to the current article.\nreset - Delete the current article. (text, tags)\nhelp - Show this help message.\n\nRe-try / Post frequency: " + (process_1.env.POST_FREQUENCY || 10) + " minutes.\nArticles in queue: " + posts.length + " (max: 10).\n";
}
function sendMessage(msg) {
    var channel = client.channels.get(process_1.env.RELEASE_CHANNEL_ID || '');
    if (channel) {
        // @ts-ignore
        channel.send(msg);
    }
}
client.on('ready', function () {
    console.log("Logged in as " + client.user.tag + "!");
});
client.on('rateLimit', function () {
    console.log('Well, shit...');
});
client.on('messageUpdate', function (_msg, newMsg) {
    // console.log(msg.id, newMsg.id);
    // console.log('Edit:', newMsg.content);
    if (lastPost && lastPost.msg.id === newMsg.id) {
        lastPost.msg = newMsg;
    }
});
client.on('message', function (msg) {
    if (msg.channel.id === process_1.env.RELEASE_CHANNEL_ID) {
        if (msg.author.bot || msg.content.startsWith('!-')) {
            return;
        }
        if (msg.content.toLowerCase().startsWith(cmdPrefix)) {
            // Handle commands here
            var cmd = msg.content.split(' ')[1];
            var args = msg.content.split(' ').splice(2);
            command(cmd, args, msg);
        }
        else {
            if (msg.content.length >= Number(process_1.env.MIN_POST_LENGTH) && msg.content.length <= Number(process_1.env.MAX_POST_LENGTH)) {
                lastPost = {
                    msg: msg,
                    tags: []
                };
                msg.channel.send("New article started.\nAdd tags with `" + cmdPrefix + " tags <tag1> <tag2>...`.\nPost to devRant with `" + cmdPrefix + " add`");
            }
            else { // Else, respond with error
                if (msg.content.length >= Number(process_1.env.MIN_POST_LENGTH)) {
                    msg.channel.send('This post seems a little long.');
                }
                else {
                    msg.channel.send('This post seems a little short.');
                }
            }
        }
    }
});
function command(cmd, args, msg) {
    switch (cmd) {
        case 'publish':
            if (posts.length > 10) {
                msg.channel.send('You may not add more articles right now. There are already 10 scheduled for release.');
                return;
            }
            if (lastPost) {
                posts.push(lastPost);
                msg.channel.send("\"" + lastPost.msg.content.substring(0, 15) + "...\" has been added to the waitlist.");
                lastPost = null;
            }
            else {
                msg.channel.send('No article to publish');
            }
            break;
        case 'length':
            msg.channel.send("There are currently " + posts.length + " news articles waiting to be posted to devRant.");
            break;
        case 'show':
            if (args[0] === 'current' && lastPost) {
                console.log(lastPost.msg.content);
                msg.channel.send("As requested, here is the current article:\n```" + lastPost.msg.content + "\n\nTags: " + lastPost.tags.join(', ') + "```");
            }
            else {
                var post = posts[Number(args[0]) - 1];
                if (post) {
                    msg.channel.send("As requested, here is article " + Number(args[0]) + ":\n```" + post.msg.content + "\n\nTags: " + post.tags.join(', ') + "```");
                }
                else {
                    msg.channel.send('Article does not exist.');
                }
            }
            break;
        case 'tags':
            if (lastPost) {
                lastPost.tags = args.filter(function (t) { return t.trim(); }).map(function (t) { return t.replace(',', ''); });
                msg.channel.send("Added tags: " + lastPost.tags.join(', ') + ".");
            }
            else {
                msg.channel.send('Article does not exist.');
            }
            break;
        case 'reset':
            lastPost = null;
            msg.channel.send('Current article deleted.');
            break;
        case 'help':
            msg.channel.send(helpText());
            break;
        default:
            msg.channel.send("Unknown command. `" + cmdPrefix + " help` for more help.");
    }
}
// Connect to discord
client.login(process_1.env.DISCORD_TOKEN)
    .catch(function (e) { return console.error(e); });
// Set interval
console.log("POST_FREQUENCY set to " + (process_1.env.POST_FREQUENCY || 10) + " minutes.");
setInterval(function () {
    if (posts.length > 0) {
        var post_1 = posts[0];
        console.log(post_1.msg.content);
        // Get authentication token from devRant API
        rantscript
            .login(String(process_1.env.DEVRANT_USENAME), String(process_1.env.DEVRANT_PASSWORD))
            .then(function (response) {
            //Then post a rant to devRant with token gotten from previous request.
            rantscript.postRant(post_1.msg.content, post_1.tags.join(','), Number(process_1.env.DEVRANT_POST_CATEGORY || 6), response.auth_token, null).then(function (resp) {
                //Then console.log the rant data.
                posts.shift();
                sendMessage("Posted article to devRant! Rant ID: " + resp.rant_id + ".");
            }).catch(function (e) {
                console.error(e);
                sendMessage('Something went wrong when posting article to devRant!');
            });
        }).catch(function (e) {
            console.error(e);
            sendMessage('Something went wrong when posting article to devRant!');
        });
    }
}, Number(process_1.env.POST_FREQUENCY || 10) * 60 * 1000);

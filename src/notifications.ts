export class Notifications {
	discordClient: any;
	devRantClient: any;
	devRantToken: object;
	notifChannelID: any;

	constructor (discordClient, devRantClient, devRantToken, notifChannelID) {
		this.discordClient = discordClient;

		this.devRantClient = devRantClient;
		this.devRantToken = devRantToken;

		this.notifChannelID = notifChannelID;
	}

	check () {
		const notifTypes = {
			'comment_content': ' comment on your rant!',
			'comment_vote':    ' ++\'d your comment!',
			'content_vote':    ' ++\'d your rant!',
			'comment_mention': ' mentioned you in a comment!'
		};

		this.devRantClient.notifications(this.devRantToken).then(response => {
			const items = response.data.items;
			const usernameMap = response.data.username_map;

			for (let i = items.length-1; i >= 0; i--) {
				const item = items[i];
				const uid = item.uid;
				const username = usernameMap[uid.toString()].name;

				// Skip read notifications
				if (item.read == 1) continue;

				// Skip unimportant notifications
				if (!Object.keys(notifTypes).includes(item.type)) continue;

				this.discordClient
				    .channels
				    .get(this.notifChannelID)
				    .send(`_**${username}** ${notifTypes[item.type]}_       >       https://devrant.com/rants/${item.rant_id}`).catch(console.error);
			}

			this.devRantClient.clearNotifications(this.devRantToken);
		});
	}
}
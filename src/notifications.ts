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

			for (let i = items.length - 1; i >= 0; i--) {
				const item = items[i];
				const uid = item.uid;

				// Skip read notifications
				if (item.read == 1) continue;

				// Skip unimportant notifications
				if (!Object.keys(notifTypes).includes(item.type)) continue;

				const username = usernameMap[uid.toString()].name;
				let avatar = usernameMap[uid.toString()].avatar.i;

				if (avatar === undefined) {
					avatar = 'https://via.placeholder.com/150/7bc8a4/?text=%20';
				} else {
					avatar = 'https://avatars.devrant.com/' + avatar;
				}

				const embed = {
					title:  `${username} ${notifTypes[item.type]}`,
					url:    'https://devrant.com/rants/' + item.rant_id,
					color:  16357990,
					footer: {
						icon_url: 'https://upload.wikimedia.org/wikipedia/commons/1/1f/DevRant_Logo.jpg',
						text:     'devRant'
					},
					author: {
						name:     username,
						url:      'https://devrant.com/users/' + username,
						icon_url: avatar
					}
				};

				this.discordClient
				    .channels
				    .get(this.notifChannelID)
				    .send({ embed }).catch(console.error);
			}

			this.devRantClient.clearNotifications(this.devRantToken);
		});
	}
}
export class Welcomer {
	welcomeGIFs: string[] = [
		'https://media.giphy.com/media/Y8ocCgwtdj29O/giphy.gif',
		'https://media.giphy.com/media/l4JyOCNEfXvVYEqB2/giphy.gif',
		'https://media.giphy.com/media/l46Cpz0A0dB1jMxG0/giphy.gif',
		'https://media.giphy.com/media/ASd0Ukj0y3qMM/giphy.gif',
		'https://media.giphy.com/media/bcKmIWkUMCjVm/giphy.gif',
		'https://media.giphy.com/media/ypqHf6pQ5kQEg/giphy.gif',
		'https://media.giphy.com/media/eoVusT7Pi9ODe/giphy.gif',
		'https://media.giphy.com/media/VUOMN3AJbxSeY/giphy.gif',
		'https://media.giphy.com/media/ToMjGpzot8uTh5nUwnu/giphy.gif',
		'https://media.giphy.com/media/l3V0uEmPgKpjZH6ve/giphy.gif',
		'https://media.giphy.com/media/BpS6k9mXoDiZa/giphy.gif',
		'https://media.giphy.com/media/qQh0DBncuFJwQ/giphy.gif',
		'https://media.giphy.com/media/10a9ikXNvR9MXe/giphy.gif',
		'https://media.giphy.com/media/kedaHiw5n9WLK/giphy.gif',
		'https://media.giphy.com/media/12B39IawiNS7QI/giphy.gif',
		'https://media.giphy.com/media/VeBeB9rR524RW/giphy.gif',
		'https://media.giphy.com/media/papraODOQ51yE/giphy.gif',
		'https://media.giphy.com/media/3o85xwGZR5UtB6SiL6/giphy.gif',
		'https://media.giphy.com/media/dVA9c3Ey7rCr6/giphy.gif',
		'https://media.giphy.com/media/3o7qE4yAEFBsdte2YM/giphy.gif',
		'https://media.giphy.com/media/3o6MbqXFOkZXI79StW/giphy.gif',
		'https://media.giphy.com/media/xM1CgbgznSyDC/giphy.gif',
		'https://media.giphy.com/media/l0MYAQ3cHSfmtJSA8/giphy.gif',
		'https://media.giphy.com/media/CEMrWPw6hSFlC/giphy.gif',
		'https://media.giphy.com/media/l0MYssj1gDoBnuj1m/giphy.gif',
		'https://media.giphy.com/media/3ohfFviABAlNf3OfOE/giphy.gif'
	];

	discordClient: any;
	welcomeChannelID: any;

	constructor (discordClient, welcomeChannelID) {
		this.discordClient = discordClient;
		this.welcomeChannelID = welcomeChannelID;

		// Listen for new members
		discordClient.on('guildMemberAdd', member => this.sendWelcomeMessage(member));
	}

	sendWelcomeMessage (member) {
		let userMention = '<@' + member.id + '>';
		let gif = this.welcomeGIFs[Math.floor(Math.random() * this.welcomeGIFs.length)];

		const welcomeMessage: object = {
			title: 'Welcome to the devNews Discord-Server!',
			description: userMention,
			color: Math.floor(Math.random() * 16777214) + 1,
			image: {
				url: gif
			}
		};

		this.discordClient
		    .channels
		    .get(this.welcomeChannelID)
		    .send({ embed: welcomeMessage }).catch(console.error);
	}
}
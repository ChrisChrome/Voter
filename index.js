var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('votes.db');

db.serialize(function () {
	db.run("CREATE TABLE IF NOT EXISTS votes (voter TEXT UNIQUE, vote TEXT)");
});

const Discord = require("discord.js");
const {
	REST
} = require('@discordjs/rest');
const {
	Routes,
	PermissionFlagsBits,

} = require('discord-api-types/v9');
const {
	clientId,
	guildId,
	token,
	blockedRoles,
	debugUser
} = require('./config.json');
const {
	config
} = require('process');
const bot = new Discord.Client({
	intents: ["GuildMembers"]
});
const commands = []

const everyCommand = [
	new Discord.SlashCommandBuilder()
	.setName('votes')
	.setDescription('Returns vote results!'),
	new Discord.SlashCommandBuilder()
	.setName('clear')
	.setDescription('Clears vote results!')
	.addStringOption(option =>
		option.setName('type')
		.setDescription('Type of vote to clear')
		.setRequired(true)
		.setChoices({
			name: 'All',
			value: 'all'
		}, {
			name: 'Individual user\'s votes',
			value: 'peruser'
		}, {
			name: 'All votes for user',
			value: 'user'
		})
	)
	.addBooleanOption(option =>
		option.setName('confirm')
		.setDescription('Confirm you want to clear votes')
		.setRequired(true)
	)
	.addUserOption(option =>
		option.setName('user')
		.setDescription('User to clear votes for')
		.setRequired(false)
	),
	new Discord.SlashCommandBuilder()
	.setName('vote')
	.setDescription('Vote on someone!')
	.addUserOption(option =>
		option.setName('user')
		.setDescription('The user to vote on')
		.setRequired(true))
]

everyCommand.forEach((slashies) => {
	commands.push(slashies.toJSON());
});

const rest = new REST({
	version: '9'
}).setToken(token);

(async () => {
	try {
		console.log('Started refreshing application (/) commands.');

		await rest.put(
			Routes.applicationCommands(clientId), {
				body: commands
			},
		);

		console.log('Successfully reloaded application (/) commands.');
	} catch (error) {
		console.error(error);
	}
})();

bot.on("ready", () => {
	console.log("Bot is ready!");
	/*
	// Delete all commands
	bot.application.commands.fetch().then(commands => {
		commands.forEach(command => {
			command.delete();
		});
	});
	*/
})

bot.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

	const {
		commandName
	} = interaction;

	switch (commandName) {
		case 'vote':
			if (interaction.options.getMember('user').user.id == interaction.user.id) {
				interaction.reply({
					content: "You can't vote for yourself!",
					ephemeral: true
				});
				return;
			}
			if (interaction.options.getMember("user")._roles.some(role => blockedRoles.includes(role))) {
				interaction.reply({
					content: "You are not allowed to vote for staff!",
					ephemeral: true
				});
				return;
			}
			var stmt = db.prepare("INSERT INTO votes VALUES (?, ?)");
			stmt.run(interaction.user.id, interaction.options.getUser("user").id, async (err) => {
				if (err) {
					console.log(err);
					return interaction.reply("You already voted!", {
						"ephemeral": true
					});
				};
				await stmt.finalize((err) => {
					interaction.reply("You voted!", {
						"ephemeral": true
					});
				});
			});
			break;
		case 'votes':
			if (!interaction.member._roles.some(role => blockedRoles.includes(role)) && interaction.user.id != debugUser) {
				interaction.reply({
					content: "You are not allowed to use this command!",
					ephemeral: true
				});
				return;
			}
			await db.all("select vote,count(*) as count from votes group by vote order by count desc limit 10", (err, results) => {
				if (err) {
					console.log(err);
					return interaction.reply("Something went wrong!", {
						"ephemeral": true
					});
				};
				interaction.reply({
					embeds: [{
						title: "Vote results",
						description: results.map((result) => {
							return `<@${result.vote}>: ${result.count}`
						}).join("\n")
					}]
				})
			});
			break;
			// clear command
		case 'clear':
			if (!interaction.member._roles.some(role => blockedRoles.includes(role)) && interaction.user.id != debugUser) {
				interaction.reply({
					content: "You are not allowed to use this command!",
					ephemeral: true
				});
				return;
			}
			if (interaction.options.getBoolean("confirm")) {
				if (interaction.options.getString("type") == "all") {
					db.run("DELETE FROM votes", (err) => {
						if (err) {
							console.log(err);
							return interaction.reply("Something went wrong!", {
								"ephemeral": true
							});
						};
						interaction.reply("Cleared all votes!", {
							"ephemeral": true
						});
					});
				} else if (interaction.options.getString("type") == "peruser") {
					if (!interaction.options.getUser("user")) {
						interaction.reply({
							content: "You need to specify a user!",
							ephemeral: true
						});
						return;
					}
					db.run("DELETE FROM votes WHERE voter = ?", interaction.options.getUser("user").id, (err) => {
						if (err) {
							console.log(err);
							return interaction.reply("Something went wrong!", {
								"ephemeral": true
							});
						};
						interaction.reply("Cleared all votes for user!", {
							"ephemeral": true
						});
					});
				} else if (interaction.options.getString("type") == "user") {
					if (!interaction.options.getUser("user")) {
						interaction.reply({
							content: "You need to specify a user!",
							ephemeral: true
						});
						return;
					}
					db.run("DELETE FROM votes WHERE vote = ?", interaction.options.getUser("user").id, (err) => {
						if (err) {
							console.log(err);
							return interaction.reply("Something went wrong!", {
								"ephemeral": true
							});
						};
						interaction.reply("Cleared all votes for user!", {
							"ephemeral": true
						});
					});
				}
			}
			break;
	}
});

bot.login(token);
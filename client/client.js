var readline = require('readline'),
	socket = require('socket.io-client')('http://localhost:3000'),
	register = require('./register.js'),
	login = require('./login.js'),
	friendClass = require('./friend.js'),
	friend = new friendClass(socket),
	msgClass = require('./message.js'),
	message = new msgClass(socket),
	fs = require('fs'),
	crypto = require('crypto');

var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

socket.on('log', function (data) {
	console.log(data);
});

socket.on('receiveFriendRequest', function (username) {
	console.log('receive friend request from: ' + username);
});

socket.on('getPublic', function (data){
	fs.writeFileSync('./static/' + data.username + '.pem', data.publicKey);
	console.log('Public key saved!');
});

var loginUser = 'anonymous';
var loginFlag = false;

rl.on('line', function(line){
	var commandType = line.split(' ')[0];
	switch(commandType){
		case 'help':
			console.log("help not implemented yet.");
			break;
		case 'register':
			register.register(line.split(' ')[1], socket);
			break;
		case 'login':
			login.login(line.split(' ')[1], socket, function (logined) {
				if (logined){
					loginUser = line.split(' ')[1];
					loginFlag = true;
				}
			});
			break;
		case 'friendlist':
			if (loginFlag){
				friend.list(socket);
			}
			break;
		case 'friend':
			if (loginFlag)
				friend.addFriend(loginUser, line.split(' ')[1], socket);
			break;
		case 'approve':
		case 'deny':
			if (loginFlag){
				var friendName = line.split(' ')[1];
				socket.emit('addFriend response', {
					'from': friendName,
					'to': loginUser,
					'action': commandType
				});
			}
			break;
		case 'require':
			if (loginFlag){
				socket.emit('require', line.split(' ')[1]);
			}
			break;
		case 'sendKey':
			if (loginFlag){
				message.sendKey(loginUser, line.split(' ')[1], socket);
			}
			break;
		case 'message':
			if (loginFlag){
				var to = line.split(' ')[1];
				var msg = line.substring('message'.length + to.length + 2);
				message.sendMsg(loginUser, to, msg, socket);
			}
			break;
		default:
			console.log("Illegal input!");
	}
});
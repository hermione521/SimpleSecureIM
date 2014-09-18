// Setup basic express server
var express = require('express'),
	app = express(),
	server = require('http').createServer(app),
	io = require('socket.io')(server),
	crypto = require('crypto'),
	Mongo = require("./dbOperation.js"),
	config = require("./config.js"),
	ursa = require('ursa'),
	fs = require('fs'),
	port = process.env.PORT || 3000;

server.listen(port, function () {
	console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/public'));

var socketSet = []

io.on('connection', function (socket) {
	socket.on('log', function (msg) {
		console.log("receive log: " + msg);
	});

	var login = false;
	var loginUser;

	// register
	// exchange symmetric key using DiffieHellman algorithm
	socket.on('register', function (data){
		if (login){
			socket.emit('log', 'ERROR: already login!');
		}
		else{
			Mongo.getPublicKey(data.username, function (pk) {
				if (pk)
					socket.emit('log', 'ERROR: user exists!');
				else{
					// calculate shared key s
					var serverDH = crypto.createDiffieHellman(config.base64Prime, 'base64');
					var publicKey = serverDH.generateKeys();
					var sharedSecret = serverDH.computeSecret(data.publicKey, 'base64', 'base64');

					// generate user's public and private keys, and save the public key
					var keys = ursa.generatePrivateKey();
					var prvPem = keys.toPrivatePem('utf8');
					var pubPem = keys.toPublicPem('utf8');
					Mongo.addUser(data.username, pubPem);

					// encrypt user's private key
					var cipher = crypto.createCipher('aes-256-cbc', sharedSecret);
					var encText = cipher.update(prvPem, 'utf8', 'base64');
					encText += cipher.final('base64');

					// calculate HMAC
					var hmac = crypto.createHmac('sha256', sharedSecret);
					hmac.update(encText);
					var hmacText = hmac.digest('base64');

					// send out
					var serverKey = fs.readFileSync('./static/public.pem');
					socket.emit('register reply', {
						'publicKey': publicKey,
						'encryptedText': encText,
						'hMAC': hmacText,
						'serverKey': serverKey.toString()
					});
				}
			});
		}
	});

	socket.on('login', function (data) {
		if (login){
			socket.emit('log', 'ERROR: already login!');
		}
		else{
			Mongo.getPublicKey(data.username, function (pk) {
				if (pk){
					// sign the random number
					var priavtePem = fs.readFileSync('./static/private.pem');
					var publicPem = fs.readFileSync('./static/public.pem');
					var sign = crypto.createSign('RSA-SHA256');
					sign.update(data.random);
					var signature = sign.sign(priavtePem.toString(), 'base64');

					// choose a new random number
					var random = crypto.randomBytes(256);

					// waiting for response
					socket.on('login client auth', function (sig){
						var verify = crypto.createVerify('RSA-SHA256');
						var result = verify.update(random);
						if (verify.verify(pk, sig, 'base64')){
							socket.emit('login result', 'success');
							socketSet.push(socket);
							Mongo.makeOnline(data.username);
							Mongo.setSocketID(data.username, socket.id);
							login = true;
							loginUser = data.username;
						}
						else{
							socket.emit('login result', 'fail');
						}
					});

					// send back data
					socket.emit('login server auth', {
						'sign': signature,
						'random': random
					});
				}
				else{
					socket.emit('log', 'ERROR: user not exists!');
				}
			});
		}
	});

	// return friend list, TODO: encrypt
	socket.on('getFriendList', function () {
		if (login){
			Mongo.getOnlineFriends(loginUser, function (friendList) {
				socket.emit('friendList', friendList);
			});
		}
	});
	// add friend, return success or fail
	socket.on('addFriend', function (data) {
		if (login){
			Mongo.getSocketID(data.to, function (socketID) {
				for (var i = socketSet.length - 1; i >= 0; i--) {
					if (socketSet[i].id === socketID){
						socketSet[i].emit('receiveFriendRequest', data.from);
						Mongo.addFR(data.from, data.to);
						break;
					}
				};
			});
		}
		else{
			socket.emit('log', 'ERROR: not login yet.');
		}
	});
	// waiting for other's response
	socket.on('addFriend response', function (data) {
		if (login){
			Mongo.existFR(data.from, data.to, function (exists){
				if (exists){
					Mongo.removeFR(data.from, data.to);
					Mongo.getSocketID(data.from, function (socketID) {
						var flag = true;
						for (var i = socketSet.length - 1; i >= 0; i--) {
							if (socketSet[i].id === socketID){
								switch (data.action){
									case 'deny':
										socketSet[i].emit('addFriend result', 'fail');
										break;
									case 'approve':
										Mongo.makeFriends(data.from, data.to);
										socketSet[i].emit('addFriend result', 'success');
										break;
									default:
										socket.emit('log', 'ERROR: action ' + data.action + ' illegal.');
								}
								flag = false;
								break;
							}
						};
						if (flag){
							socket.on('log', 'ERROR: user ' + data.to + ' not online.');
						}
					});
				}
				else{
					socket.emit('log', 'ERROR: person ' + data.from + " didn't add you friend.");
				}
			});
		}
		else{
			socket.emit('log', 'ERROR: not login yet.');
		}
	});

	// return friend's public key
	socket.on('require', function (friendName) {
		Mongo.checkFriends(friendName, loginUser, function (flag, publicKey) {
			if (flag){
				socket.emit('getPublic', {
					'username': friendName,
					'publicKey': publicKey
				});
			}
			else{
				socket.emit('log', 'ERROR: ' + friendName + ' is not your friend.');
			}
		});
	});

	// message
	socket.on('sth send', function (data) {
		Mongo.checkFriends(data.from, data.to, function (flag, publicKey) {
			if (flag){
				Mongo.getSocketID(data.to, function (socketID) {
					if (socketID){
						for (var i = socketSet.length - 1; i >= 0; i--) {
							if (socketSet[i].id === socketID){
								if (data.message)
									socketSet[i].emit('message receive', data);
								else
									socketSet[i].emit('key receive', data);
								break;
							}
						};
					}
					else{
						socket.emit('log', 'ERROR: socketID not found.');
					}
				});
			}
			else{
				socket.emit('log', 'ERROR: ' + data.to + ' is not your friend.');
			}
		});
		
	});
});

io.on('disconnect', function (socket) {
	Mongo.makeOffline(data.username);
	for (var i = socketSet.length - 1; i >= 0; i--) {
		if (socketSet[i].id === socket.id){
			delete socketSet[i];
			break;
		}
	};
});

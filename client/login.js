var crypto = require('crypto'),
	fs = require('fs');

var Login = function () {

}

Login.prototype.login = function(username, socket, callback) {
	var random = crypto.randomBytes(256);

	socket.on('login server auth', function (data) {
		var serverPub = fs.readFileSync('./static/server.pem');
		var clientPrv = fs.readFileSync('./static/private.pem');

		var verify = crypto.createVerify('RSA-SHA256');
		var result = verify.update(random);
		if (verify.verify(serverPub.toString(), data.sign, 'base64')){
			// wait for final result
			socket.on('login result', function (result) {
				console.log('login result: ' + result);
				callback(true);
			});

			// sign random bytes and send back
			var sign = crypto.createSign('RSA-SHA256');
			sign.update(data.random);
			var signature = sign.sign(clientPrv.toString(), 'base64');
			socket.emit('login client auth', signature);
		}
		else{
			console.log('ERROR: server auth failed.');
			callback(false);
		}
	});

	socket.emit('login', {
		'username': username,
		'random': random
	});
};

module.exports = new Login();
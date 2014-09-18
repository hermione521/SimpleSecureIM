var crypto = require('crypto'),
	ursa = require('ursa'),
	fs = require('fs');

var Register = function () {
	this.base64Prime = "1zUQalgBPxqhp2tcZGwPDwxJJZArKtXrVej7O04FnUs=";
}

Register.prototype.register = function (username, socket) {
	// DiffieHellman
	var clientDH = crypto.createDiffieHellman(this.base64Prime, 'base64');
	var publicKey = clientDH.generateKeys();

	socket.on('register reply', function (data) {
		// calculate shared key
		var sharedSecret = clientDH.computeSecret(data.publicKey, 'utf8', 'base64');

		// check hMAC
		var hmac = crypto.createHmac('sha256', sharedSecret);
		hmac.update(data.encryptedText);
		var hmacText = hmac.digest('base64');
		if (hmacText !== data.hMAC){
			console.log('hMAC not the same!!!');
		}
		else{
			// decrypt user's private key
			var decipher = crypto.createDecipher('aes-256-cbc', sharedSecret);
			var prvPem = decipher.update(data.encryptedText, 'base64', 'utf8');
			prvPem += decipher.final('utf8');

			// save to file
			fs.writeFileSync('./static/private.pem', prvPem);
			fs.writeFileSync('./static/server.pem', data.serverKey);

			console.log('register success!');
		}
	});

	socket.emit('register', {
		'username': username,
		'publicKey': publicKey
	});
};

module.exports = new Register();
var fs = require('fs'),
	ursa = require('ursa'),
	crypto = require('crypto');

var Message = function (socket) {
	this.init(socket);
	Message.symKeySet = {};
}

Message.prototype.init = function (socket) {
	socket.on('message receive', function (data) {
		// decrypt message
		var key = Message.symKeySet[data.from];
		var decipher = crypto.createDecipher('aes-256-cbc', key);
		var dec = decipher.update(data.message, 'base64', 'utf8');
		dec += decipher.final('utf8');

		// check hMAC
		var hmac = crypto.createHmac('sha256', key);
		hmac.update(data.message);
		var hmacText = hmac.digest('base64');

		data.message = dec;
		console.log(data);
		console.log('hMAC check: ' + (hmacText === data.hmac));
	});

	socket.on('key receive', function (data) {
		var prvPem = fs.readFileSync('./static/private.pem').toString();
		// decrypt symmetric key and save
		var key = ursa.createPrivateKey(prvPem, 'utf8');
		data.key = key.decrypt(data.key, 'base64', 'utf8');
		Message.symKeySet[data.from] = data.key;
		console.log('Symmetric key with '+ data.from + ' saved.');
	});
}

Message.prototype.sendKey = function (from, to, socket) {
	// generate random bytes and save
	var random = crypto.randomBytes(50).toString();
	Message.symKeySet[to] = random;

	// encrypt message with friend's public key
	var pubPem = fs.readFileSync('./static/' + to + '.pem').toString();
	var key = ursa.createPublicKey(pubPem, 'utf8');
	var encKey = key.encrypt(random, 'utf8', 'base64');

	socket.emit('sth send', {
		'from': from,
		'to': to,
		'key': encKey
	});
}

Message.prototype.sendMsg = function (from, to, msg, socket) {
	//  encrypt message
	var key = Message.symKeySet[to];
	var cipher = crypto.createCipher('aes-256-cbc', key);
	var crypted = cipher.update(msg, 'utf8', 'base64');
	crypted += cipher.final('base64');

	// calculate hMAC
	var hmac = crypto.createHmac('sha256', key);
	hmac.update(crypted);
	var hmacText = hmac.digest('base64');

	socket.emit('sth send', {
		'from': from,
		'to': to,
		'message': crypted,
		'hmac': hmacText
	});
}

module.exports = Message;

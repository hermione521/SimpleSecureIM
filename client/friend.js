var Friend = function (socket) {
	this.init(socket);
}

Friend.prototype.init = function (socket) {
	socket.on('friendList', function (friendList) {
		console.log(friendList);
	});

	socket.on('addFriend result', function (res) {
		console.log('addFriend result: ' + res);
	});
}

Friend.prototype.list = function (socket) {
	socket.emit('getFriendList');
};

Friend.prototype.addFriend = function (from, to, socket) {
	socket.emit('addFriend', {
		'from': from,
		'to': to
	});
};

module.exports = Friend;

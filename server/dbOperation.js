var mongoose = require('mongoose');

var Mongo = function (){
	mongoose.connect('mongodb://localhost/im');

	// registered user info
	var userSchema = mongoose.Schema({
	    username: String,
	    publicKey: String,
	    online: Boolean,
	    socketID: String,
	    friendList: [String]
	});
	Mongo.User = mongoose.model('User', userSchema);

	var FRSchema = mongoose.Schema({
		from: String,
		to: String
	});
	Mongo.FR = mongoose.model('FR', FRSchema);
}

Mongo.prototype.addFR = function (from, to) {
	var newFR = new Mongo.FR({
		'from': from,
		'to': to
	});
	newFR.save();
}

Mongo.prototype.removeFR = function (from, to) {
	Mongo.FR.remove({'from': from, 'to': to}, function (err) {
		if (err)
			console.log(err);
	});
}

Mongo.prototype.existFR = function (from, to, callback) {
	Mongo.FR.findOne({'from': from, 'to': to}, 'from', function (err, res) {
		callback(res);
	});
}

Mongo.prototype.getPublicKey = function (username, callback) {
	Mongo.User.findOne({'username': username}, 'publicKey', function (err, publicKey) {
		if (err)
			console.log(err);
		else
			callback(publicKey ? publicKey.publicKey : publicKey);
	});
};

Mongo.prototype.getSocketID = function (username, callback) {
	Mongo.User.findOne({'username': username}, 'socketID', function (err, socketID) {
		if (err)
			console.log(err);
		else
			callback(socketID ? socketID.socketID : socketID);
	});
};

Mongo.prototype.setSocketID = function (username, socketID) {
	Mongo.User.update({'username': username}, {
		$set :{'socketID': socketID}
	}, function (err, num) {
		if (err)
			console.log(err);
	});
}

Mongo.prototype.addUser = function (username, publicKey) {
	var newUser = new Mongo.User({
		'username': username,
		'publicKey': publicKey,
		'online': false,
		'friendList': {}
	});
	newUser.save();
};

Mongo.prototype.makeOnline = function (username) {
	Mongo.User.update({'username': username}, {
		$set: {'online': true}
	}, function (err, num) {
		if (err)
			console.log(err);
	});
}

Mongo.prototype.makeOffline = function (username) {
	Mongo.User.update({'username': username}, {
		$set: {'online': false}
	}, function (err, num) {
		if (err)
			console.log(err);
	});
}

Mongo.prototype.getOnlineFriends = function (username, callback){
	Mongo.User.findOne({'username': username}, 'friendList', function (err, res) {
		var list = res.friendList;
		for (var i = list.length - 1; i >= 0; i--) {
			Mongo.User.findOne({'username': list[i], online: true}, 'username', function (Oerr, Ores) {
				if (!Ores){ //not exists
					delete list[i];
				}
			});
		};
		callback(list);
	});
}

Mongo.prototype.makeFriends = function (alice, bob) {
	Mongo.User.update({'username': bob}, {
		$addToSet: {
			friendList: alice
		}
	}, function (err, num) {
		if (err)
			console.log(err);
	});
	Mongo.User.update({'username': alice}, {
		$addToSet: {
			friendList: bob
		}
	}, function (err, num) {
		if (err)
			console.log(err);
	});
}

Mongo.prototype.checkFriends = function (alice, bob, callback) {
	Mongo.User.findOne({'username': alice}, 'friendList publicKey', function (err, res) {
		var index = res.friendList.indexOf(bob);
		var flag = (index === -1) ? false : true;
		callback(flag, res.publicKey);
	});
}


module.exports = new Mongo();
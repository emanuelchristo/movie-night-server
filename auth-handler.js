const { v4: uuidv4 } = require('uuid')
const _ = require('lodash')

module.exports = (io, { users, rooms }) => {
	function login({ userId, nickName }, callback) {
		// Check if userId exists - then reauthenticate
		console.log('login', userId, nickName)
		if (nickName) {
			console.log('here')
			callback(createNewUser(nickName, this.id))
			console.log(users)
		} else if (userId) {
			const user = users.find((user) => user.id === userId)
			console.log('login user foudn using id', user)
			if (user) {
				user.socketId = this.id
				callback(user)
			} else callback(null)
		}
		// If nickName exists - create new user
		else callback(null)

		function createNewUser(nick, socketId) {
			const newUser = {
				nickName: nick,
				id: uuidv4(),
				socketId,
			}
			users.push(newUser)
			return newUser
		}
	}

	function logout({ userId }, callback) {
		console.log('logout')

		const { leaveRoom } = require('./room-handler')(io, { users, rooms })

		// Leaving from room
		const roomId = Object.keys(this.rooms).find((room) => room !== this.id)
		const user = users.find((user) => user.socketId === this.id)
		if (user && roomId) {
			console.log('leaving')
			const userId = user.id
			console.log(roomId, userId)
			leaveRoom({ userId, roomId }, true)
		}

		_.remove(users, (u) => u.id === userId)

		callback(true)
	}

	return { login, logout }
}

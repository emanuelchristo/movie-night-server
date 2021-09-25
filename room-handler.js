const randomstring = require('randomstring')

DEV = true

module.exports = (io, { users, rooms }) => {
	function createRoom(userId, callback) {
		console.log('createRoom', userId)
		console.log('users', users)
		// Verifying user
		const user = verifyUser(userId)
		console.log('createRoom - user verify', user)

		if (!user) {
			callback(null)
			return
		}

		let roomId = randomstring.generate({ length: 6, charset: 'alphabetic' })
		let room = {
			id: roomId,
			timestamp: new Date().toJSON(),
			name: null,
			imageLink: null,
			started: false,
			playing: false,

			video: {
				added: false,
				type: null,
				link: null,
				thumbnail: null,
				title: null,
			},

			player: {
				loaded: false,
				playing: false,
				time: 0,
				speed: 0,
				volume: 0,
				captions: null,
			},

			host: {
				id: userId,
				nickName: user.nickName,
				ready: false,
				micOff: true,
			},

			participants: [],
		}
		rooms.push(room)

		// Joining the room
		joinRoom({ userId, roomId }, this)

		callback(room)
	}

	function getRoom(roomId, callback) {
		console.log('getRoom')
		// Getting the room
		const room = verifyRoom(roomId)

		// Joining socket-io room
		this.join(roomId)

		callback(room)
	}

	function joinRoom({ userId, roomId }, socket) {
		console.log('joinRoom - ', userId, roomId)
		// Verifying incoming data
		const user = verifyUser(userId)
		const room = verifyRoom(roomId)
		console.log(users)
		console.log(user, room)
		if (!(user && room)) return

		// Checking if participant already in the room
		// let participant = room.participants.find((p) => p.id === userId)
		const newParticipant = {
			id: userId,
			nickName: user.nickName,
			ready: false,
			micOff: true,
		}
		// if (participant) participant = newParticipant
		// else
		room.participants.push(newParticipant)

		// Joining socket-io room
		let socketRef
		if (this.join) socketRef = this
		else socketRef = socket
		socketRef.join(roomId)

		// Removing user from room on disconnect
		socketRef.on('disconnecting', () => {
			console.log('disconnecting')
			const roomId = Object.keys(socketRef.rooms).find((room) => room !== socketRef.id)
			const user = users.find((user) => user.socketId === socketRef.id)
			if (user && roomId) {
				console.log('leaving')
				const userId = user.id
				console.log(roomId, userId)
				leaveRoom({ userId, roomId }, true)
			}
		})

		// Room update
		io.to(roomId).emit('room:updated', room)
	}

	function addVideo({ userId, roomId, video }) {
		console.log('addVideo')
		// Verifying incoming data
		const user = verifyUser(userId)
		const room = verifyRoom(roomId)
		const isHost = checkIfHost(user, room)
		if (!(user && room && isHost)) return

		// Adding video to room
		const { added, type, link, thumbnail, title } = video
		room.video = {
			added,
			type,
			link,
			thumbnail,
			title,
		}
		if (room.video.type == 'youtube') {
			room.name = title
			room.imageLink = thumbnail
		}

		console.log('updating room')
		// Pushing changes to participants
		io.to(roomId).emit('room:updated', room)
	}

	function removeVideo({ userId, roomId, video }) {
		console.log('removeVideo')
		// Verifying incoming data
		const user = verifyUser(userId)
		const room = verifyRoom(roomId)
		const isHost = checkIfHost(user, room)
		if (!(user && room && isHost)) return

		room.video = {
			added: false,
			type: null,
			link: null,
			thumbnail: null,
			title: null,
		}

		// Pushing changes to participants
		io.to(roomId).emit('room:updated', room)
	}

	function startRoom({ userId, roomId, data }) {
		console.log('startRoom')
		// Verifying incoming data
		const user = verifyUser(userId)
		const room = verifyRoom(roomId)
		const isHost = checkIfHost(user, room)
		if (!(user && room && isHost)) return

		const { roomName, imageLink } = data
		room.name = roomName
		room.imageLink = imageLink
		room.started = true
		room.playing = true

		// Pushing changes to participants
		io.to(roomId).emit('room:updated', room)
	}

	function setRoomInfo({ userId, roomId, data }) {
		console.log('setRoomInfo')
		// Verifying incoming data
		const user = verifyUser(userId)
		const room = verifyRoom(roomId)
		const isHost = checkIfHost(user, room)
		if (!(user && room && isHost)) return

		const { roomName, imageLink } = data
		room.name = roomName
		room.imageLink = imageLink

		// Pushing changes to participants
		io.to(roomId).emit('room:updated', room)
	}

	function stop({ roomId, userId }) {
		console.log('stop')
		// Verifying incoming data
		const user = verifyUser(userId)
		const room = verifyRoom(roomId)
		const isHost = checkIfHost(user, room)
		if (!(user && room && isHost)) return
		room.playing = false

		// Pushing changes to participants
		io.to(roomId).emit('room:updated', room)
	}

	function sync({ roomId, userId, data }) {
		console.log('sync')
		// Verifying incoming data
		const user = verifyUser(userId)
		const room = verifyRoom(roomId)
		const isHost = checkIfHost(user, room)
		if (!(user && room)) return

		if (isHost) {
			const { loaded, playing, time, speed, volume, captions } = data
			room.player = {
				loaded,
				playing,
				time,
				speed,
				volume,
				captions,
			}
		} else {
			const host = verifyUser(room.host.id)
			if (host) io.to(host.socketId).emit('room:syncrequest')
		}

		// Pushing changes to participants
		io.to(roomId).emit('room:updated', room)
	}

	function leaveRoom({ roomId, userId }, hostTempLeave) {
		console.log('leaveRoom')
		// Verifying incoming data
		const user = verifyUser(userId)
		const room = verifyRoom(roomId)
		const isHost = checkIfHost(user, room)
		if (!(user && room)) return

		if (isHost && !hostTempLeave) room.started = false
		else {
			const newParticipants = room.participants.filter((p) => p.id != userId)
			room.participants = newParticipants
		}

		// Pushing changes to participants
		io.to(roomId).emit('room:updated', room)
	}

	// Verifying user
	function verifyUser(userId) {
		if (!userId) return null
		const user = users.find((user) => user.id === userId)
		return user
	}
	// Verifying room
	function verifyRoom(roomId) {
		if (!roomId) return null
		const room = rooms.find((room) => room.id === roomId)
		return room
	}
	// Checking if user is the host of the room
	function checkIfHost(user, room) {
		if (!user || !room) return false
		return user.id === room.host.id
	}

	return { createRoom, getRoom, joinRoom, addVideo, removeVideo, startRoom, setRoomInfo, stop, sync, leaveRoom }
}

""" Controller for flack web app """

from datetime import datetime

from flask import Flask, render_template, session, redirect, request
from flask_socketio import SocketIO, send, emit, join_room, leave_room
from flask_session import Session

from helpers import signin_required, random_hex_lightcolor

app = Flask(__name__)
app.config["SESSION_TYPE"] = "filesystem"
Session(app)
socketio = SocketIO(app, manage_session=False)

# dictionary of users
# keys = user name and value = {
#   key: channel value: current channel
#   key: hexcode value: hexcode of color
# }
users = {}

# dictionary of channels
# keys = channel name value =  {
#   key users value user list
#   key messages value message dict list
# }
rooms = {}

# Message id dictionary
# keeps the count of number of messages
counter = {
    "msg_id": 0
}


@app.route("/")
@signin_required
def index():
    """ Todo """
    return render_template("index.html", channels=rooms)


@app.route("/signin", methods=["GET", "POST"])
def signin():
    """ Sign in a user"""
    if request.method == "GET":
        return render_template("signin.html")

    user = request.form["display_name"]

    if user in users:
        return "name taken"

    color = random_hex_lightcolor()

    users[user] = {
        "color": color
    }

    session["user"] = user
    return redirect("/")


@app.route("/signout")
@signin_required
def signout():
    """ Sign out a user """

    # Deletes session data
    if session["user"] in users:
        del users[session["user"]]
    session.pop("user", None)
    return redirect("/signin")


@socketio.on("add channel")
@signin_required
def add_channel(data):
    """ Adds a channel """

    # room/channel name
    room = data["channel"].lower()

    if len(room) == 0:
        return {"success": False, "reason": "Invalid channel name!"}
    if room in rooms:
        return {"success": False, "reason": "Channel already exists!"}
    rooms[room] = {
        "users": [],
        "messages": []
    }
    emit("channel created", {"channel": room}, broadcast=True)
    return {"success": True}


@socketio.on("join")
@signin_required
def on_join(data):
    """ Joins user to a room """

    if data.get("channel") is None:
        if users[session["user"]].get("room"):
            room = users[session["user"]]["room"]
        else:
            return {"success": False, "reason": "Room is None!"}
    else:
        room = data["channel"]

    if not room in rooms:
        return {"success": False, "reason": "No such room!"}

    if session["user"] in rooms[room]["users"]:
        return {"success": False, "reason": "You are already present in room!"}

    if users[session["user"]].get("room") and not room == users[session["user"]]["room"]:
        return {"success": False,
                "reason": "You are already present in another room, leave that first!"}

    join_room(room)
    rooms[room]["users"].append(session["user"])
    users[session["user"]]["room"] = room

    # Channel space for user
    members = rooms[room]["users"]
    messages = rooms[room]["messages"]
    color = {}

    for user in users:
        color[user] = users[user]["color"]

    channel_space = render_template("channel.html", channel=room,
                                    members=members, messages=messages,
                                    color=color)
    emit("channel joined",
         {"user": session["user"], "channel": room}, skip_sid=request.sid, room=room)

    return {"success": True, "user": session["user"],
            "channel": room, "channel_space": channel_space}


@socketio.on("leave")
@signin_required
def on_leave():
    """ Remove user from a room """

    if users[session["user"]].get("room") is None:
        return {"success": False}

    room = users[session["user"]]["room"]
    leave_room(room)

    user = session["user"]
    rooms[room]["users"].remove(user)
    del users[user]["room"]

    emit("channel left",
         {"user": user, "channel": room}, room=room)
    return {"success": True, "room": room}


@socketio.on("message")
@signin_required
def msg(data):
    """ Send message of the user to correct room """
    content = data["message"]
    room = users[session["user"]]["room"]

    # getting current date time
    date_time = datetime.now()
    current_date = date_time.strftime("%d-%m-%Y")
    current_time = date_time.strftime("%I:%M:%S %p")

    counter["msg_id"] += 1
    message = {
        "id": counter["msg_id"],
        "by": session["user"],
        "date": current_date,
        "time": current_time,
        "content": content
    }

    # color = users[session["user"]]["color"]
    if len(rooms[room]["messages"]) > 100:
        rooms[room]["messages"].pop(0)

    rooms[room]["messages"].append(message)

    reply = {
        "message": render_template("message.html",
                                   message=message,
                                   color=users[session["user"]]["color"],
                                   include_delete=False),
        "msg_id": message["id"]
    }
    send(reply, skip_sid=request.sid, room=room)
    return {
        "message": render_template("message.html",
                                   message=message,
                                   color=users[session["user"]]["color"],
                                   include_delete=True)
    }


@socketio.on("delete message")
def del_msg(data):
    """ Deletes user message """
    msg_id = data["msg_id"]

    room = users[session["user"]]["room"]
    messages = rooms[room]["messages"]

    for idx, message in enumerate(messages):
        if str(message["id"]) == msg_id and message["by"] == session["user"]:
            messages[idx]["content"] = "[message deleted]"
            # messages.remove(message)
            emit("message removed", {
                "msg_id": msg_id,
            }, skip_sid=request.sid, room=room)
            return {"success": True}

    return {"success": False, "reason": "Message not found"}


@socketio.on("connect")
@signin_required
def connect():
    """ When a user connects to socket add it to his/her previously joined room """
    print("======================================")
    print("SID: ", request.sid, "User: ", session["user"], "connected!")
    print("======================================")


@socketio.on("disconnect")
@signin_required
def disconnect():
    """ Removes user on disconnect form user list of channel """
    print("======================================")
    print("SID: ", request.sid, "User: ", session["user"], "disconnected!")
    print("======================================")

    user = session["user"]
    if not users[user].get("room") is None:
        rooms[users[user]["room"]]["users"].remove(user)
        emit("channel left",
             {"user": user, "channel": users[user]["room"]}, room=users[user]["room"])

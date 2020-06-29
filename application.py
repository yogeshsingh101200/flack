""" Controller for flack web app """

import os

from datetime import datetime

from flask import Flask, render_template, session, redirect, request
from flask_socketio import SocketIO, emit, join_room, leave_room

from helpers import signin_required, random_hex_darkcolor

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
socketio = SocketIO(app)

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


@app.before_request
def make_permanent_session():
    """ Makes flask sessions permanent """
    session.permanent = True


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

    color = random_hex_darkcolor()

    users[user] = {
        "color": color
    }

    session["user"] = user
    return redirect("/")


@ app.route("/signout")
@ signin_required
def signout():
    """ Sign out a user """

    # Deletes session data
    if session["user"] in users:
        del users[session["user"]]
    session.pop("user", None)
    return redirect("/signin")


@ socketio.on("add channel")
def add_channel(data):
    """ Adds a channel """

    # room/channel name
    room = data["channel"].lower()

    if len(room) == 0:
        emit("channel created", {"success": False}, broadcast=True)
    else:
        if room in rooms:
            emit("channel created", {"success": False}, broadcast=True)
        else:
            rooms[room] = {
                "users": [],
                "messages": []
            }
            emit("channel created", {"success": True,
                                     "channel": room}, broadcast=True)


@socketio.on("join")
def on_join(data):
    """ Joins user to a room """

    room = data["channel"]
    join_room(room)

    user = session["user"]
    rooms[room]["users"].append(user)
    users[user]["room"] = room

    emit("channel joined",
         {"user": user, "channel": room}, room=room)


@socketio.on("leave")
def on_leave(data):
    """ Remove user from a room """
    room = data["channel"]
    leave_room(room)

    user = session["user"]
    rooms[room]["users"].remove(user)
    del users[user]["room"]

    emit("channel left",
         {"user": user, "channel": room}, room=room)


@app.route("/channel_space")
def channel_space():
    """ Displays channel page """
    room = users[session["user"]]["room"]
    members = rooms[room]["users"]
    messages = rooms[room]["messages"]

    color = {}

    for user in users:
        color[user] = users[user]["color"]

    return render_template("channel.html", channel=room,
                           members=members, messages=messages,
                           color=color)


@ socketio.on("message sent")
def msg_sent(data):
    """ Send message of the user to correct room """
    content = data["message"]
    room = data["channel"]

    # getting current date time
    date_time = datetime.now()
    current_date = date_time.strftime("%d-%m-%Y")
    current_time = date_time.strftime("%I:%M:%S %p")

    message = {
        "by": session["user"],
        "date": current_date,
        "time": current_time,
        "content": content
    }

    color = users[session["user"]]["color"]
    if len(rooms[room]["messages"]) > 100:
        rooms[room]["messages"].pop(0)

    rooms[room]["messages"].append(message)
    emit("message received", {"message": message,
                              "hexcode": color}, room=room)


@socketio.on("connect")
def connect():
    """ When a user connects to socket add it to his/her previously joined room """
    print("======================================")
    print("SID: ", request.sid, "User: ", session["user"], "connected!")
    print("======================================")

    user = session["user"]
    if not users[user].get("room") is None:
        room = users[user]["room"]
        join_room(room)
        rooms[room]["users"].append(user)
        emit("channel joined",
             {"user": user, "channel": room}, room=room)


@socketio.on("disconnect")
def disconnect():
    """ Removes user on disconnect form user list of channel """
    print("======================================")
    print("SID: ", request.sid, "User: ", session["user"], "disconnected!")
    print("======================================")

    user = session["user"]

    if not users[user].get("room") is None:
        if user in rooms[users[user]["room"]]["users"]:
            rooms[users[user]["room"]]["users"].remove(user)
            emit("channel left",
                 {"user": user, "channel": users[user]["room"]}, room=users[user]["room"])

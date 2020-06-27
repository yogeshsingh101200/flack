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
# keys = user name and value = color code
users = {}

# dictionary of channels
# keys = channel name value =  {
#   key users value user list
#   key messages value message dict list
# }
channels = {}


@app.before_request
def make_permanent_session():
    """ Makes flask sessions permanent """
    session.permanent = True


@app.route("/")
@signin_required
def index():
    """ Todo """
    return render_template("index.html", channels=channels)


@app.route("/signin", methods=["GET", "POST"])
def signin():
    """ Sign in a user"""
    if request.method == "GET":
        return render_template("signin.html")

    user = request.form["display_name"]

    if user in users:
        return "name taken"

    color = random_hex_darkcolor()

    users[user] = color

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

    # Channel name
    channel_name = data["channel"].lower()

    if len(channel_name) == 0:
        emit("channel created", {"success": False}, broadcast=True)
    else:
        if channel_name in channels:
            emit("channel created", {"success": False}, broadcast=True)
        else:
            channels[channel_name] = {
                "users": [],
                "messages": []
            }
            emit("channel created", {"success": True,
                                     "channel": channel_name}, broadcast=True)


@socketio.on("join")
def on_join(data):
    """ Joins user to a room """

    room = data["room"]
    user = session["user"]

    channel = channels[room]
    channel["users"].append(user)
    join_room(room)

    emit("channel joined",
         {"user": user, "channel": room}, room=room)


@socketio.on("leave")
def on_leave(data):
    """ Remove user from a room """
    room = data["room"]
    user = session["user"]

    channel = channels[room]
    channel["users"].remove(user)

    leave_room(room)

    emit("channel left",
         {"user": user, "channel": room}, room=room)


@app.route("/channel_space", methods=["POST"])
def channel_space():
    """ Displays channel page """
    channel = request.form.get("channel")
    members = channels[channel]["users"]
    messages = channels[channel]["messages"]

    return render_template("channel.html", channel=channel,
                           members=members, messages=messages,
                           hexcode=users)


@socketio.on("message sent")
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

    color_code = users[session["user"]]

    channel = channels[room]
    if len(channel["messages"]) > 10:
        print(channel["messages"])
        channel["messages"].pop(0)

    channel["messages"].append(message)
    emit("message received", {"message": message,
                              "hexcode": color_code}, room=room)


@ socketio.on("disconnect")
def disconnect():
    """ Removes user on disconnect form user list of channel """
    print("======================================")
    print("SID: ", request.sid, "User: ", session["user"], "disconnected!")
    print("======================================")
    user = session["user"]
    usr_present_room = None

    for channel in channels:
        room = channels[channel]
        if user in room["users"]:
            usr_present_room = channel
            room["users"].remove(user)
            break

    emit("channel left",
         {"user": user, "channel": usr_present_room}, room=usr_present_room)

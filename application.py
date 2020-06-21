""" Controller for flack web app """

import os

from datetime import datetime

from flask import Flask, render_template, session, redirect, request
from flask_socketio import SocketIO, emit, join_room, leave_room

from helpers import signin_required

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
socketio = SocketIO(app)

# List of users
users = []

# dictionary of channels
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

    users.append(user)

    session["user"] = user
    return redirect("/")


@app.route("/signout")
@signin_required
def signout():
    """ Sign out a user """

    # Deletes session data
    if session["user"] in users:
        users.remove(session["user"])
    session.pop("user", None)
    return redirect("/signin")


@socketio.on("add channel")
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
    return render_template("channel.html", messages=channels[channel]["messages"])


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

    channel = channels[room]
    channel["messages"].append(message)
    emit("message received", {"message": message}, room=room)


@socketio.on("disconnect")
def disconnect():
    """ Tests if a user disconnects on refresh """
    user = session["user"]

    for channel in channels:
        room = channels[channel]
        if user in room["users"]:
            room["users"].remove(user)

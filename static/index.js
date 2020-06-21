document.addEventListener("DOMContentLoaded", () => {

    // Connect to websocket
    var socket = io.connect(location.protocol + "//" + document.domain + ":" + location.port);

    var current_channel = "none";

    if (localStorage.getItem("current_channel")) {
        current_channel = localStorage.getItem("current_channel");
    }

    // By default, submit button is disabled
    document.querySelector("#btn-create-channel").disabled = true;

    // Enable button only if there is text in the input field
    document.querySelector("#channel-name").onkeyup = () => {
        if (document.querySelector("#channel-name").value.length > 0)
            document.querySelector("#btn-create-channel").disabled = false;
        else
            document.querySelector("#btn-create-channel").disabled = true;
    };

    // When sockets get connected
    socket.on("connect", () => {
        if (current_channel != "none") {
            socket.emit("join", {
                "room": current_channel
            });
            document.querySelector(`#${current_channel}`).disabled = true;
        }

        // When user adds a channel
        document.querySelector("#create-channel-form").onsubmit = () => {

            // Get channel
            const channel = document.querySelector("#channel-name").value;

            // Send selected channel to server
            socket.emit("add channel", {
                "channel": channel
            });

            // Prevents form from submitting to server through server
            return false;
        };
    });

    socket.on("channel created", data => {
        if (data.success) {
            // Create list item with class channels
            const li = document.createElement("li");
            li.setAttribute("class", "channels");

            // Create channel join button
            const button = document.createElement("button");
            button.setAttribute("id", data.channel);
            button.innerHTML = data.channel;

            // Add button to list
            li.append(button);

            // Add list to channel list
            document.querySelector("#channel-list").append(li);

            // Clears input field and disables submit button
            document.querySelector("#channel-name").value = "";
            document.querySelector("#btn-create-channel").disabled = true;

            // Gets updated channel list
            get_channels();
        }
    });

    function get_channels() {

        // Join channel room when user clicks on it
        document.querySelectorAll(".channels > button").forEach(button => {
            button.onclick = function () {

                if (current_channel != "none") {
                    document.querySelector(`#${current_channel}`).disabled = false;
                    socket.emit("leave", {
                        "room": current_channel
                    });
                }
                socket.emit("join", {
                    "room": this.innerHTML
                });
                this.disabled = true;
            };
        });
    }

    // Get already created channels
    get_channels();

    socket.on("channel joined", data => {
        current_channel = data.channel;
        localStorage.setItem("current_channel", current_channel);

        if (!document.querySelector("#messages")) {
            // Requests server for channel.html
            const request = new XMLHttpRequest();
            request.open("POST", "/channel_space");

            // On successful request
            request.onload = () => {

                // Adds channel.html content to document
                document.querySelector("#channel-space").innerHTML = request.responseText;

                usr_joined_alert();

                // Listen for user message sent
                listen_for_msg_sending();

                // Listen for leave channel
                listen_leave_channel();
            };

            const form_data = new FormData();
            form_data.set("channel", current_channel);

            // Sends Request
            request.send(form_data);
        }
        else {
            usr_joined_alert();

            // Listen for user message sent
            listen_for_msg_sending();

            // Listen for leave channel
            listen_leave_channel();
        }

        // Notifies members of a channel when a user joins
        function usr_joined_alert() {
            const li = document.createElement("li");
            li.innerHTML = `[${data.user} joined ${current_channel}]`;
            document.querySelector("#messages").append(li);
        }
    });


    function listen_for_msg_sending() {
        // By default, submit button is disabled
        document.querySelector("#send-msg").disabled = true;

        // Enable button only if there is text in the input field
        document.querySelector("#message").onkeyup = () => {
            if (document.querySelector("#message").value.length > 0)
                document.querySelector("#send-msg").disabled = false;
            else
                document.querySelector("#send-msg").disabled = true;
        };

        // When user sends a message
        document.querySelector("#message-form").onsubmit = () => {
            socket.emit("message sent", {
                "message": document.querySelector("#message").value,
                "channel": current_channel
            });

            document.querySelector("#message").value = "";
            document.querySelector("#send-msg").disabled = true;

            // Stops message from submitting through http (sockets to be used instead)
            return false;
        };
    }

    function listen_leave_channel() {
        document.querySelector("#leave").onclick = () => {
            socket.emit("leave", {
                "room": current_channel
            });

            document.querySelector(`#${current_channel}`).disabled = false;
            current_channel = "none";
            localStorage.setItem("current_channel", current_channel);
            document.querySelector("#channel-space").innerHTML = "";
        };
    }

    socket.on("channel left", data => {
        const li = document.createElement("li");
        li.innerHTML = `[${data.user} has left ${data.channel}]`;
        document.querySelector("#messages").append(li);
    });

    // When channel receives a message
    socket.on("message received", data => {

        const template = `${data.message.date} ${data.message.time}
        <br>
        ${data.message.content}
        <br>
        <small>By ${data.message.by}</small>`;

        // Adding message to list of messages
        const li = document.createElement("li");
        li.setAttribute("class", "msg");
        li.innerHTML = template;
        document.querySelector("#messages").append(li);
    });
});

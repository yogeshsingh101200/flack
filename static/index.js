document.addEventListener("DOMContentLoaded", () => {

    // Connect to websocket
    var socket = io.connect(location.protocol + "//" + document.domain + ":" + location.port);

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

        socket.emit("join", { "channel": null }, response => {
            if (response.success) {
                join_channel(response);
            }
        });

        // When user adds a channel
        document.querySelector("#create-channel-form").onsubmit = () => {

            // Get channel
            const channel = document.querySelector("#channel-name").value;

            // Send selected channel to server
            socket.emit("add channel", {
                "channel": channel
            }, response => {
                if (!response.success) {
                    alert(response.reason);
                } else {
                    // Clears input field and disables submit button
                    document.querySelector("#channel-name").value = "";
                    document.querySelector("#btn-create-channel").disabled = true;
                }
            });

            // Prevents form from submitting to server through server
            return false;
        };
    });

    socket.on("channel created", data => {
        // Create channel join button
        const button = document.createElement("button");
        button.setAttribute("id", data.channel);
        button.setAttribute("class", "dropdown-item");
        button.innerHTML = data.channel;

        // Add button to channel list
        document.querySelector("#channel-list").append(button);

        updateHeightOfChannelList();

        // Add listener to button
        button.onclick = reactOnClickOnChannel;
    });

    function reactOnClickOnChannel() {

        // Leave channel if there is any previously joined channel
        socket.emit("leave", response => {
            if (response.success) {
                const ele = document.querySelector(`#${response.room}`);
                ele.disabled = false;
                ele.classList.remove("active");
                document.querySelector("#channel-space").innerHTML = "";
            }
        });

        // Join new channel
        socket.emit("join", {
            "channel": this.innerHTML
        }, response => {
            if (!response.success) {
                alert(response.reason);
            }
            else {
                join_channel(response);
            }
        });
    }

    function updateHeightOfChannelList() {
        buttons = document.querySelectorAll("#channel-list > button");

        if (buttons.length > 5) {
            document.querySelector("#channel-list").style.height = "25vh";
        }
        else {
            document.querySelector("#channel-list").style.height = "auto";
        }
    }

    function get_channels() {
        updateHeightOfChannelList();

        buttons = document.querySelectorAll("#channel-list > button");

        buttons.forEach(button => {
            button.onclick = reactOnClickOnChannel;
        });
    }

    // Get already created channels
    get_channels();

    function join_channel(data) {
        const ele = document.querySelector(`#${data.channel}`);
        ele.classList.add("active");
        ele.disabled = true;

        // Adds channel.html content to document
        document.querySelector("#channel-space").innerHTML = data.channel_space;

        // Listen for user message sent
        listen_for_msg_sending();

        // Listen for leave channel
        listen_leave_channel();

        // Scolls all the messages till bottom
        updateScroll(document.querySelector("#msg-wrapper"), true);

        // Add colors to user names
        addColors(document.querySelectorAll(".usr-name"));
    }

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
            socket.send({
                "message": document.querySelector("#message").value
            });

            document.querySelector("#message").value = "";
            document.querySelector("#send-msg").disabled = true;

            // Stops message from submitting through http (sockets to be used instead)
            return false;
        };
    }

    function listen_leave_channel() {
        document.querySelector("#leave").onclick = () => {
            socket.emit("leave", response => {
                if (response.success) {
                    const ele = document.querySelector(`#${response.room}`);
                    ele.disabled = false;
                    ele.classList.remove("active");
                    document.querySelector("#channel-space").innerHTML = "";
                }
            });
        };
    }

    socket.on("channel joined", data => {
        // Notifies members of a channel when a user joins
        setTimeout(() => {
            const element = document.querySelector("#msg-wrapper");
            bottomScrolled = isScrolledToBottom(element);

            const li = document.createElement("li");
            li.innerHTML = `[${data.user} joined ${data.channel} ]`;
            li.classList.add("text-center");
            document.querySelector("#messages").append(li);

            updateScroll(element, bottomScrolled);
        }, 0);

        // Add member to member list
        setTimeout(() => {
            const li = document.createElement("li");
            li.innerHTML = data.user;
            document.querySelector("#memberList").append(li);
        }, 0);
    });

    socket.on("channel left", data => {
        const element = document.querySelector("#msg-wrapper");
        bottomScrolled = isScrolledToBottom(element);

        const li = document.createElement("li");
        li.innerHTML = `[${data.user} has left ${data.channel} ]`;
        li.classList.add("text-center");
        document.querySelector("#messages").append(li);
        removeMember(data.user);

        updateScroll(element, bottomScrolled);
    });

    function removeMember(member) {
        document.querySelectorAll("#memberList > li").forEach(li => {
            let memberInli = li.innerHTML;
            if (memberInli === member) {
                li.remove();
            }
        });
    }

    // When channel receives a message
    socket.on("message", data => {
        const element = document.querySelector("#msg-wrapper");
        bottomScrolled = isScrolledToBottom(element);

        const template = `< small > ${data.message.date} ${data.message.time}</small >
        <p>
            <span class="usr-name" data-color="${data.color}">${data.message.by}</span>
                    : ${data.message.content}
        </p>`;

        // Creating message for list of messages
        const li = document.createElement("li");
        li.setAttribute("class", "msg");
        li.innerHTML = template;

        // Add color to user name
        const ele = li.querySelector(".usr-name");
        ele.style.color = ele.dataset.color;

        // Adding to list of messages
        document.querySelector("#messages").append(li);

        updateScroll(element, bottomScrolled);
    });

    function updateScroll(element, bottomScrolled) {
        if (bottomScrolled) {
            element.scrollTop = element.scrollHeight - element.clientHeight;
        }
    }

    function isScrolledToBottom(element) {
        return !(element.scrollTop + 1 < element.scrollHeight - element.clientHeight);
    }

    function addColors(elementList) {
        elementList.forEach(element => {
            element.style.color = element.dataset.color;
        });
    }

    window.addEventListener("beforeunload", () => {
        socket.disconnect();
    });
});

document.addEventListener("DOMContentLoaded", () => {

    // Connect to websocket
    var socket = io.connect(location.protocol + "//" + document.domain + ":" + location.port);

    var current_channel = null;

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
            // Create channel join button
            const button = document.createElement("button");
            button.setAttribute("id", data.channel);
            button.setAttribute("class", "dropdown-item");
            button.innerHTML = data.channel;

            // Add button to channel list
            document.querySelector("#channel-list").append(button);

            // Clears input field and disables submit button
            document.querySelector("#channel-name").value = "";
            document.querySelector("#btn-create-channel").disabled = true;

            // Gets updated channel list
            get_channels();
        }
    });

    function get_channels() {

        // Join channel room when user clicks on it
        buttons = document.querySelectorAll("#channel-list > button");

        if (buttons.length > 5) {
            document.querySelector("#channel-list").style.height = "25vh";
        }
        else {
            document.querySelector("#channel-list").style.height = "auto";
        }

        buttons.forEach(button => {
            button.onclick = function () {

                if (current_channel) {
                    const ele = document.querySelector(`#${current_channel}`);
                    ele.disabled = false;
                    ele.classList.remove("active");

                    socket.emit("leave");
                    document.querySelector("#channel-space").innerHTML = "";
                }
                socket.emit("join", {
                    "channel": this.innerHTML
                });
                this.disabled = true;
            };
        });
    }

    // Get already created channels
    get_channels();

    socket.on("channel joined", data => {

        if (!document.querySelector("#messages")) {
            current_channel = data.channel;
            const ele = document.querySelector(`#${current_channel}`);
            ele.classList.add("active");
            ele.disabled = true;

            // Requests server for channel.html
            const request = new XMLHttpRequest();
            request.open("GET", "/channel_space");

            // On successful request
            request.onload = () => {

                // Adds channel.html content to document
                document.querySelector("#channel-space").innerHTML = request.responseText;

                usr_joined_alert();

                // Listen for user message sent
                listen_for_msg_sending();

                // Listen for leave channel
                listen_leave_channel();

                updateScroll(document.querySelector("#msg-wrapper"), true);

                addColors(document.querySelectorAll(".usr-name"));
            };

            // Sends Request
            request.send();
        }
        else {
            usr_joined_alert();

            // Listen for user message sent
            listen_for_msg_sending();

            // Listen for leave channel
            listen_leave_channel();

            addMember(data.user);
        }

        // Notifies members of a channel when a user joins
        function usr_joined_alert() {
            const element = document.querySelector("#msg-wrapper");
            bottomScrolled = isScrolledToBottom(element);

            const li = document.createElement("li");
            li.innerHTML = `[ ${data.user} joined ${current_channel} ]`;
            li.classList.add("text-center");
            document.querySelector("#messages").append(li);

            updateScroll(element, bottomScrolled);
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
            socket.emit("leave");

            const ele = document.querySelector(`#${current_channel}`);
            ele.disabled = false;
            ele.classList.remove("active");
            current_channel = null;
            document.querySelector("#channel-space").innerHTML = "";
        };
    }

    function addMember(member) {
        const li = document.createElement("li");
        li.innerHTML = member;
        document.querySelector("#memberList").append(li);
    }

    socket.on("channel left", data => {
        const element = document.querySelector("#msg-wrapper");
        bottomScrolled = isScrolledToBottom(element);

        const li = document.createElement("li");
        li.innerHTML = `[ ${data.user} has left ${data.channel} ]`;
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
    socket.on("message received", data => {
        const element = document.querySelector("#msg-wrapper");
        bottomScrolled = isScrolledToBottom(element);

        const template = `<small>${data.message.date} ${data.message.time}</small>
            <p>
                <span class="usr-name" data-color="${data.hexcode}">${data.message.by}</span>
                : ${data.message.content}
            </p>`;

        // Adding message to list of messages
        const li = document.createElement("li");
        li.setAttribute("class", "msg");
        li.innerHTML = template;
        document.querySelector("#messages").append(li);

        updateScroll(element, bottomScrolled);
        addColors(document.querySelectorAll(".usr-name"));
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

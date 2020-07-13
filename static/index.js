document.addEventListener("DOMContentLoaded", () => {

    // Connect to websocket
    var socket = io.connect(location.protocol + "//" + document.domain);

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

        if (buttons.length > 13) {
            document.querySelector("#channel-list").style.height = "65vh";
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

        // Listenes for delete msg
        document.querySelectorAll(".msg .delete-msg").forEach(msg => {
            msg.onclick = deleteMsg;
        });

        // Listenes for reply
        document.querySelectorAll(".msg .reply-msg").forEach(msg => {
            msg.onclick = replyMsg;
        });
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
            }, response => {
                const element = document.querySelector("#msg-wrapper");
                bottomScrolled = isScrolledToBottom(element);

                // Creating message for list of messages
                const li = document.createElement("li");
                li.setAttribute("class", "d-flex flex-column align-items-end mb-1");
                li.innerHTML = response.message;

                // Adding to list of messages
                document.querySelector("#messages").append(li);

                // Listen for reply to message
                li.querySelector(".reply-msg").onclick = replyMsg;

                // Add color to user name
                const ele = li.querySelector(".usr-name");
                ele.style.color = ele.dataset.color;

                // Listen for delete message
                li.querySelector(".delete-msg").onclick = deleteMsg;

                updateScroll(element, bottomScrolled);
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
        const element = document.querySelector("#msg-wrapper");
        bottomScrolled = isScrolledToBottom(element);

        const li = document.createElement("li");
        li.innerHTML = `[${data.user} joined ${data.channel} ]`;
        li.classList.add("text-center");
        document.querySelector("#messages").append(li);

        updateScroll(element, bottomScrolled);

        // Add member to member list
        const member = document.createElement("li");
        member.innerHTML = data.user;
        document.querySelector("#memberList").append(member);
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

        // Creating message for list of messages
        const li = document.createElement("li");
        li.setAttribute("class", "d-flex flex-column align-items-start mb-1");
        li.innerHTML = data.message;

        // Adding to list of messages
        document.querySelector("#messages").append(li);

        // Listen for reply message
        li.querySelector(".reply-msg").onclick = replyMsg;

        // Add color to user name
        const ele = li.querySelector(".usr-name");
        ele.style.color = ele.dataset.color;

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

    function deleteMsg() {
        socket.emit("delete message", {
            "msg_id": this.parentElement.parentElement.dataset.id
        }, response => {
            if (!response.success) {
                alert(response.reason);
            } else {
                const element = this.parentElement.parentElement;
                element.querySelector(".msg-content").innerHTML = "[message deleted]";
            }
        });
        return false;
    }

    socket.on("message removed", data => {
        document.querySelectorAll(".msg").forEach(msg => {
            if (msg.dataset.id === data.msg_id) {
                msg.querySelector(".msg-content").innerHTML = "[message deleted]";
            }
        });
    });

    function replyMsg() {
        document.querySelector(".quoted-msg").innerHTML = "";
        const ele = this.parentElement.cloneNode(true);
        ele.removeChild(ele.querySelector(".reply-msg"));
        document.querySelector(".quoted-msg").append(ele);

        listen_for_reply(this.parentElement.parentElement.dataset.id);

        // Wait for modal transition to complete
        setTimeout(() => {
            document.querySelector("#reply").focus();
        }, 500);

        return false;
    }

    function listen_for_reply(msgId) {

        // By default, submit button is disabled
        document.querySelector("#send-reply").disabled = true;

        // Enable button only if there is text in the input field
        document.querySelector("#reply").onkeyup = () => {
            if (document.querySelector("#reply").value.length > 0)
                document.querySelector("#send-reply").disabled = false;
            else
                document.querySelector("#send-reply").disabled = true;
        };

        // When user sends a message
        document.querySelector("#message-reply-form").onsubmit = () => {
            document.querySelector("#close-reply").click();

            socket.emit("reply", {
                "reply": document.querySelector("#reply").value,
                "msg_id": msgId
            }, response => {
                const element = document.querySelector("#msg-wrapper");

                // Creating message for list of messages
                const li = document.createElement("li");
                li.setAttribute("class", "d-flex flex-column align-items-end mb-1");
                li.innerHTML = response.message;

                // Adding to list of messages
                document.querySelector("#messages").append(li);

                // Listen for reply to message
                li.querySelector(".reply-msg").onclick = replyMsg;

                // Add color to user name
                const ele = li.querySelector(".usr-name");
                ele.style.color = ele.dataset.color;

                // Listen for delete message
                li.querySelector(".delete-msg").onclick = deleteMsg;

                // Waits for completion of modal fade out transition
                setTimeout(() => {
                    updateScroll(element, true);
                }, 300);
            });

            document.querySelector("#reply").value = "";
            document.querySelector("#send-reply").disabled = true;

            // Stops message from submitting through http (sockets to be used instead)
            return false;
        };
    }

    socket.on("replied", data => {
        const element = document.querySelector("#msg-wrapper");
        bottomScrolled = isScrolledToBottom(element);

        // Creating message for list of messages
        const li = document.createElement("li");
        li.setAttribute("class", "d-flex flex-column align-items-start mb-1");
        li.innerHTML = data.message;

        // Adding to list of messages
        document.querySelector("#messages").append(li);

        // Listen for reply message
        li.querySelector(".reply-msg").onclick = replyMsg;

        // Add color to user name
        const ele = li.querySelector(".usr-name");
        ele.style.color = ele.dataset.color;

        updateScroll(element, bottomScrolled);
    });

    window.addEventListener("beforeunload", () => {
        socket.disconnect();
    });
});

function jump(ele) {
    var url = location.href;
    location.href = `#${ele.dataset.ref}`;
    history.replaceState(null, null, url);
    target = document.getElementById(ele.dataset.ref);
    const original = target.style.opacity;
    target.style.opacity = 0.5;
    setTimeout(() => {
        target.style.opacity = original;
    }, 500);
}
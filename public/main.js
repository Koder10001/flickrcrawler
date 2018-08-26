window.onload = function(){
    var socket = io();
    socket.on("connect",function(){
        addLog({status: "success",content: "Connected"});
    });
    socket.on("disconnect",function(){
        addLog({status: "error",content:"Disconnected"});
    })
    socket.on("reply",function(data){
        addLog(data);
    })
    $("#url").onkeyup = function(event){
        if(event.keyCode == 13){
            socket.emit("start",{mode: $("#mode").value,url: this.value},function(data){
                addLog(data);
            })
            this.value = "";
        }
    }
}
function addLog(data){
    $("#log").innerHTML += '<div class="line"><div class="' + data.status + '">' + data.status + '</div><div class="content">' + data.content + '</div></div>'
    $("#log").scrollTop = $("#log").scrollHeight;
}
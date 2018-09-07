"use-strict";
var http = require("http").createServer(handler);
var io = require("socket.io")(http);
var fs = require("fs");
var Flickr = require("flickrapi");
var rimraf = require("rimraf");
var path = require("path");
var zipper = require("zip-local");
if(!fs.existsSync(path.join("public","pictures"))){
    fs.mkdirSync(path.join("public","pictures"));
}
var flickrOptions = {
    api_key: "af1146a2df5582ec7a4b02c644eb2c1f",
    secret: "0ebfc840048d60b1",
    user_id: '143988946@N05',
    access_token: '72157700484389675-24d7a90f926a3398',
    access_token_secret: '0096f537b1c3cfcf'
};

const __path = path.join("public");
function handler(req,res){
    if(req.url == "/"){
        req.url = "index.html";
    }
    fs.readFile(path.join(__path,req.url),function (err, data) {
        if (err) {
            res.writeHead(500);
            return res.end(err.toString());
        }
        res.writeHead(200);
        res.end(data);
    });
}
http.listen(process.env.PORT || 80,function(){
    console.log("listening on " + (process.env.PORT || 80));
});

io.on("connection",function(socket){

    socket.on("start",function(data){
        if(data.mode == undefined || data.url == ""){
            socket.emit("reply",{status: "error", content: "missing arguments"});
            return;
        }
        socket.emit("reply",{status: "success", content: "authenticating"});
        Flickr.authenticate(flickrOptions, function(error, flickr) {
            switch (data.mode) {
                case "pht":
                    //get user id
                    id(flickr,flickr.urls.lookupUser,flickr.people.getPhotos,data,socket,["photos","photo"],"user_id");
                break;
                case "alb":
                    filepath = path.join("pictures",data.mode + "-"+data.url.split("/")[6]+".txt")
                    fs.writeFileSync(path.join(__path,filepath),"");
                    socket.emit("reply",{status: "success",content:data.url.split("/")[6]});
                    flickr.urls.lookupUser({
                        api_key: flickrOptions.api_key,
                        authenticated: true,
                        url: data.url
                    },function(err,result){
                        get(data.url.split("/")[6],socket,flickr.photosets.getPhotos,flickr,data.mode,["photoset","photo"],"photoset_id",filepath,result.user.id);
                    });
                break;
                case "fav":
                    id(flickr,flickr.urls.lookupUser,flickr.favorites.getList,data,socket,["photos","photo"],"user_id");
                break;
                case "gal":
                    id(flickr,flickr.urls.lookupGallery,flickr.galleries.getPhotos,data,socket,["photos","photo"],"gallery_id");
                break;
                case "grp":
                    id(flickr,flickr.urls.lookupGroup,flickr.groups.pools.getPhotos,data,socket,["photos","photo"],"group_id");
                break;
                case "all":
                    if(data.url.substring(0,3)== "zip"){
                        let username = data.url.substring(3).trim();
                        if(fs.existsSync(path.join(__path,"pictures",username))){
                            if(fs.existsSync(path.join(__path,"pictures",username+".zip"))){
                                fs.unlinkSync(path.join(__path,"pictures",username+".zip"));
                            }
                            zipper.sync.zip(path.join(__path,"pictures",username)).compress().save(path.join(__path,"pictures",username+".zip"));
                            rimraf(path.join(__path,"pictures",username),function(error){});
                            socket.emit("reply",{status: "success",content: "Zipped <a href='pictures/"+username+".zip'>"+username+".zip</a>"});
                        }
                        else {
                            socket.emit("reply",{status: "error",content: "Not found"});
                        }
                    }
                    else {
                        flickr.urls.lookupUser({
                            api_key: flickrOptions.api_key,
                            authenticated: true,
                            url: data.url
                        },function(err,result){
                            allAlb(flickr,result.user.id,data,socket,result.user.id);
                        });
                    }
                break;
                default:
                    socket.emit("reply",{status: "error",content: "Choose a mode !!!"});
                    return;
                break;
            }
        });
    })
})

function allAlb(flickr,id,data,socket,userid,pagealb = 1){
    flickr.photosets.getList({
        api_key: flickrOptions.api_key,
        authenticated:true,
        user_id: id,
        page : pagealb,
        per_page:500
    },function(err,result){
        result.photosets.photoset.forEach(ids => {
            filepath = path.join("pictures",userid,data.mode + "-"+ids.id+".txt");
            if (!fs.existsSync(path.dirname(path.join(__path,filepath)))){
                fs.mkdirSync(path.dirname(path.join(__path,filepath)));
            }
            fs.writeFileSync(path.join(__path,filepath),"");
            get(ids.id,socket,flickr.photosets.getPhotos,flickr,data.mode,["photoset","photo"],"photoset_id",filepath,userid);
        })
        if(result.photosets.page < result.photosets.pages){
            allAlb(flickr,id,list,data,socket,pagealb+1);
        }
        else{
            socket.emit("reply",{status:"success",content:"When done wait a few min then \`zip "+userid+"\`"});
        }
    })
}




function id(flickr,getid,method,data,socket,element,idname,userid = undefined){
    getid({
        api_key: flickrOptions.api_key,
        authenticated: true,
        url: data.url
    },function(err,result){
        if(err){
            socket.emit("reply",{status: "error",content: err.toString()});
        }
        else {
            socket.emit("reply",{status: "success",content: (result.user|| result.gallery || result.group).id});
            let user_id = (result.user|| result.gallery || result.group).id;
            filepath = path.join("pictures",data.mode + "-"+user_id+".txt")
            fs.writeFileSync(path.join(__path,filepath),"");
            get((result.user|| result.gallery || result.group).id,socket,method, flickr,data.mode,element,idname,filepath,userid);
        }
    })
}


function get(id,socket,method,flickr,mode,element,idname,filepath,userid,page = 1){
    let user_id = id;
    let option = {
        api_key: flickrOptions.api_key,
        authenticated: true,
        per_page: 500,
        page: page,
        user_id : userid
    }
    option[idname] = id;
    method(option,a = function(err,result){
        if(err){
            console.log(err);
            method(option,a);
            return;
        }
        let download = function(arr,index = 0,list = []){
            new Promise((resolve,reject)=>{
                let length = result[element[0]][element[1]].length;
                flickr.photos.getSizes({
                    api_key: flickrOptions.api_key,
                    photo_id: arr[element[0]][element[1]][index].id,
                    authenticated: true,
                },retry = function(err,result){
                    if(err){
                        flickr.photos.getSizes({
                            api_key: flickrOptions.api_key,
                            photo_id: arr[element[0]][element[1]][index].id,
                            authenticated: true,
                        },retry);
                        return;
                    }
                    else{
                        fs.appendFileSync(path.join(__path,filepath),result.sizes.size[result.sizes.size.length -1].source + "\n")
                        if(list.length == length){
                            socket.emit("reply",{status: "success",content: (500*(page - 1) + arr[element[0]][element[1]].length)+"/"+arr[element[0]].total});
                            return;
                        }
                        console.log(arr[element[0]].page + " : " + list.length+"/"+length);
                        resolve([arr,index + 1,list]);
                    }
                })
            }).then((data)=>{
                if((data[1]) < data[0][element[0]][element[1]].length){
                    download(data[0],data[1],data[2])
                }
            })
        }
        download(result);
        if(result[element[0]].pages > page){
            get(id,socket,method,flickr,mode,element,idname,filepath,userid ,page+1);
        }
        else {
            socket.emit("reply",{status: "success", content: '<a download href="' + filepath + '">'+ mode + '-'+user_id+'.txt</a>'})
        }
    });
}
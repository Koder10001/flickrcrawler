var http = require("http").createServer(handler);
var io = require("socket.io")(http);
var fs = require("fs");
var Flickr = require("flickrapi");
var path = require("path");

var flickrOptions = {
    api_key: "af1146a2df5582ec7a4b02c644eb2c1f",
    secret: "0ebfc840048d60b1",
    user_id: '143988946@N05',
    access_token: '72157700484389675-24d7a90f926a3398',
    access_token_secret: '0096f537b1c3cfcf'
};

const __path = path.join(__dirname,"public");
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
                    fs.writeFileSync(path.join(__path,"pictures",data.mode + "-"+data.url.split("/")[6]+".txt"),"");
                    socket.emit("reply",{status: "success",content:data.url.split("/")[6]});
                    flickr.urls.lookupUser({
                        api_key: flickrOptions.api_key,
                        authenticated: true,
                        url: data.url
                    },function(err,result){
                        get(data.url.split("/")[6],socket,flickr.photosets.getPhotos,flickr,data.mode,["photoset","photo"],"photoset_id",result.user.id);
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
                    flickr.urls.lookupUser({
                        api_key: flickrOptions.api_key,
                        authenticated: true,
                        url: data.url
                    },function(err,result){
                        var list = [];
                        allAlb(flickr,result.user.id,list,data,socket,result.user.id);
                    });
                break;
                default:
                    socket.emit("reply",{status: "error",content: "Choose a mode !!!"});
                    return;
                break;
            }
        });
    })
})

// Flickr.authenticate(flickrOptions, function(error, flickr) {

// });




function allAlb(flickr,id,list,data,socket,userid,pagealb = 1){
    flickr.photosets.getList({
        api_key: flickrOptions.api_key,
        authenticated:true,
        user_id: id,
        page : pagealb,
        per_page:500
    },function(err,result){
        result.photosets.photoset.forEach(ids => {
            fs.writeFileSync(path.join(__path,"pictures",userid,data.mode + "-"+ids.id+".txt"),"");
            console.log(ids.id);
            list.push(path.join(__path,"pictures",data.mode + "-"+ids.id+".txt"));
            get(ids.id,socket,flickr.photosets.getPhotos,flickr,data.mode,["photoset","photo"],"photoset_id",userid);
        })
        if(result.photosets.page < result.photosets.pages){
            allAlb(flickr,id,list,data,socket,pagealb+1);
        }
        else{
            socket.emit("reply",{status:"success",content:list});
        }
    })
}




















function id(flickr,getid,method,data,socket,element,idname,userid = null){
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
            // get list photo
            fs.writeFileSync(path.join(__path,"pictures",data.mode + "-"+user_id+".txt"),"");
            get((result.user|| result.gallery || result.group).id,socket,method, flickr,data.mode,element,idname,userid);
        }
    })
}

function get(id,socket,method,flickr,mode,element,idname,userid,page = 1){
    let user_id = id;
    let option = {
        api_key: flickrOptions.api_key,
        authenticated: true,
        per_page: 500,
        page: page,
        user_id : userid
    }
    option[idname] = id;
    method(option,function(err,result){
        if(err){
            console.log(err);
            return;
        }
        result[element[0]][element[1]].forEach(element => {
            flickr.photos.getSizes({
                api_key: flickrOptions.api_key,
                photo_id: element.id,
                authenticated: true,
            },function(err,result){
                if(fs.statSync(path.join(__path,"pictures",mode + "-"+user_id+".txt")).size == 0){
                    fs.appendFileSync(path.join(__path,"pictures",mode + "-"+user_id+".txt"),result.sizes.size[result.sizes.size.length -1].source);
                }
                else {
                    fs.appendFileSync(path.join(__path,"pictures",mode + "-"+user_id+".txt"),"\r\n" + result.sizes.size[result.sizes.size.length -1].source);
                }
            })
        });
        if(result[element[0]].pages > page){
            socket.emit("reply",{status: "success",content: (500*page)+"/"+result[element[0]].total});
            get(id,socket,method,flickr,mode,element,idname,page+1);
        }
        else {
            socket.emit("reply",{status: "success",content: (500*(page-1)+result[element[0]][element[1]].length)+"/"+result[element[0]].total});
            socket.emit("reply",{status: "success", content: '<a download href="pictures/'+ mode + '-'+user_id+'.txt">'+ mode + '-'+user_id+'.txt</a>'})
        }
    });
}
// Flickr.authenticate(flickrOptions, function(error, flickr) {
//     console.log(flickr);
// });
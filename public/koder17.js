function $(node){
    var a = document.querySelectorAll(node);
    if(a.length == 1){
        return a[0];
    }
    else {
        return a;
    }
}
function rand(min, max){
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
Array.prototype.last = function(){
    return this[this.length - 1];
};
Array.prototype.equal = function(arr){
    return JSON.stringify(this) == JSON.stringify(arr);
}
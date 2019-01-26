if (document.referrer === "http://localhost:3000/comment" || document.referrer === "https://anonbotwl.glitch.me/comment") {
    showSnackbar();
}
function showSnackbar() {
    var x = document.getElementById("snackbar");
    x.className = "show";
    setTimeout(function(){ x.className = x.className.replace("show", ""); }, 3000);
}

Vue.directive('click-outside', {
    bind () {
        this.event = event => this.vm.$emit(this.expression, event)
        this.el.addEventListener('click', this.stopProp)
        document.body.addEventListener('click', this.event)
    },   
    unbind() {
        this.el.removeEventListener('click', this.stopProp)
        document.body.removeEventListener('click', this.event)
    },

    stopProp(event) { event.stopPropagation() }
});

var faqButton = new Vue({
    el: '#faqButtonContainer',
    methods: {
        faqDialog: (e) => {
            faqDialog.toggleDialog();
        }
    }
});

var faqDialog = new Vue({
    el: '#faqDialog',
    data: function(){
        return {
            marginLeft: "-100%"
        };
    },
    methods: {
        toggleDialog: function(){
            this.marginLeft = (this.marginLeft == "-100%") ? "0px" : "-100%";
        },
        state: function(){
            return (this.marginLeft == "-100%") ? false : true;
        }
    }
});

document.addEventListener("click", (e) => {
    if(faqDialog.state() && !e.target.closest('div#faqDialog') && !e.target.closest('#faqButtonContainer')){
        faqDialog.toggleDialog();
    }
    //console.log(f)
});

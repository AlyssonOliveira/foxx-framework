var Common = {
  init: function init(){
    $.fn.serializeObject = function() {
      var o = {};
      var a = this.serializeArray();
      $.each(a, function() {
        if (o[this.name] !== undefined) {
          if (!o[this.name].push) {
            o[this.name] = [o[this.name]];
          }
          o[this.name].push(this.value || '');
        } else {
          o[this.name] = this.value || '';
        }
      });
      return o;
    };
  },

  buildForm: function buildForm(obj, fields, formId, back_str) {
    var html = "";
    fields.forEach(function(l, i) {
      if (l.h !== undefined) {
        html += '<div class="uk-grid uk-grid-small uk-margin-top"><h3>'+ l.h +'</h3></div>'
      }
      else {
        if (l.r && i > 0) html += '</div>'
        if (l.r) html += '<div class="uk-grid uk-grid-small">'
        if (l.c.indexOf("uk-width") == -1) l.c = "uk-width-" + l.c

        html += '<div class="'+ l.c +'">'
        if (l.j._flags.presence === "required") {
          l.l = "<strong>" + l.l + "*</strong>"
        }  
        html += '<label for="" class="uk-form-label">'+ l.l +'</label>'
        var value = obj[l.n]
        if(value === undefined) value = ""
        if(l.t === "string") html += '<input type="text" id="'+l.n+'" class="uk-width-1-1" name="'+ l.n +'" value="'+value+'"><div data-hint="'+ l.n +'" class="uk-text-danger"></div>'
        if(l.t === "date") html += '<div class="uk-form-icon uk-width-1-1"><i class="uk-icon-calendar"></i><input type="text" id="'+l.n+'" class="uk-width-1-1" name="'+ l.n +'" data-uk-datepicker="{format:\'DD-MM-YYYY\'}" value="'+value+'"></div><div data-hint="'+ l.n +'" class="uk-text-danger"></div>'
        if(l.t === "text") html += '<textarea id="'+l.n+'" class="uk-width-1-1" name="'+ l.n +'">'+ value +'</textarea><div data-hint="'+ l.n +'" class="uk-text-danger"></div>'
        if(l.t === "list") {
          html += '<select name="'+ l.n +'" class="uk-width-1-1" id="'+l.n+'">'
          _.each(l.d, function(o) {
            value = ""
            if(obj[l.n] === o[0]) value="selected='selected'"
            html += '<option value="'+ o[0] +'" '+value+'>'+ o[1] +'</option>'
          })
          html += '</select>'
        }
        html += '</div>'  
      }
    })
    html += '</div>'
    html += '<hr><div class="uk-grid uk-grid-small uk-text-right"><div class="uk-width-1-1">'
    if (back_str != undefined) {
      html += '<a href="/#'+ back_str +'" class="uk-button"><i class="uk-icon-chevron-left"></i> Back</a> '
    }
    html += '<button class="uk-button uk-button-success"><i class="uk-icon-save"></i> Save</button></div></div><hr>'

    $(formId).html(html)
    riot.update()
  },

  checkLogin: function checkLogin() {
    $.get(url + "auth/whoami", function(d) {
      if(d.username === null) riot.route('/login');
    })
  },

  checkLoginAndRedirect: function checkLogin() {
    $.get(url + "auth/whoami", function(d) {
      if(d.username === null) document.location.href = "login.html";
    })
  },

  average: function (arr) {
    return _.reduce(arr, function(memo, num) {
      return memo + num;
    }, 0) / (arr.length === 0 ? 1 : arr.length);
  },

  checkForm: function(formID, path, callback) {    
    var json = JSON.stringify($("#"+ formID).serializeObject())
    $("div[data-hint]").html("")
    var errors = null
    $.get(url + path + "/check_form?data=" + json, function(d) {
      $("#"+ formID + " input, #"+ formID + " select").removeClass("uk-form-danger")
      $("#"+ formID + " input, #"+ formID + " select").removeClass("uk-form-success")
      $("#"+ formID + " input, #"+ formID + " select").addClass("uk-form-success")
      if(d.errors.length > 0) {
        errors = d.errors
        _.each(d.errors, function(e) {
          $("#" + e.path).removeClass("uk-form-success")  
          $("#" + e.path).addClass("uk-form-danger")
          $("div[data-hint="+e.path+"]").html("<div>"+e.message+"</div>")
        })
      }

      setTimeout(function() {
        $("#"+ formID +" input, #"+ formID +" select").removeClass("uk-form-success")
      }, 300 )
      callback(errors)
    })
  },

  saveForm: function (formID, path, objID) {
    objID = objID||""
    
    var json = JSON.stringify($("#"+ formID).serializeObject())
    $("div[data-hint]").html("")
    $.get(url + path + "/check_form?data=" + json, function(d) {
      $("#"+ formID + " input, #"+ formID + " select").removeClass("uk-form-danger")
      $("#"+ formID + " input, #"+ formID + " select").removeClass("uk-form-success")
      $("#"+ formID + " input, #"+ formID + " select").addClass("uk-form-success")
      if(d.errors.length > 0) {
        _.each(d.errors, function(e) {
          $("#" + e.path).removeClass("uk-form-success")  
          $("#" + e.path).addClass("uk-form-danger")
          $("div[data-hint="+e.path+"]").html("<div>"+e.message+"</div>")
        })
      } else {
        $.ajax(url + path + "/" + objID, {
          data: json,
          method: "POST",
          success: function(d) {
            if(objID == "") {
              objID = d.key._key
              riot.route("/"+ path +"/" + objID + "/edit")
            }
          },
          statusCode: {
            401: function() {
              document.location.href = "login.html";
            }
          }
        })
      }
      setTimeout(function() {
        $("#"+ formID +" input, #"+ formID +" select").removeClass("uk-form-success")
      }, 300 )
    }) 
  }

};

module.exports = Common;
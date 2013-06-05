/*
From http://forr.st/posts/Backbone_js_super_function-4co
Used like this:

  Model = Backbone.model.extend({
      set: function(arg){
          // your code here

          // call the super class function
          this._super('set', arg);
      }
  });

It is kind of a bummer that you still have to specify the functions name, 
but I like it better than the alternatives.


Using the constructor with out the super wrapper:

  this.constructor.__super__.set.apply(this, args)

Or referencing the object directly:

  Backbone.Model.prototype.set.apply(this, args);

*/

Backbone.Model.prototype._super =
Backbone.Collection.prototype._super =
Backbone.View.prototype._super = function(funcName) {
    return this.constructor.__super__[funcName].apply(this, _.rest(arguments));
}


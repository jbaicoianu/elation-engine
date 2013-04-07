elation.component.add('engine.things.aicontroller', function() {

  this.initAIController = function() {
    this.behaviors = {};
    this.activebehavior = false;
    this.thinktime = 0;
    this.lastthink = 0;
    elation.events.add(this, 'thing_think', this);
  }
  this.addBehavior = function(name, func, thinktime) {
    this.behaviors[name] = {func: func, thinktime: thinktime};
  }
  this.setBehavior = function(behavior, args) {
    if (!this.activebehavior) {
      // we're not even registered as a thinker yet
      if (this.parent) {
        this.engine.systems.get('ai').add(this);
      } else {
        elation.events.add(this, 'thing_create', elation.bind(this, function() {
          this.engine.systems.get('ai').add(this);
        }));
      }
    }
    this.activebehavior = [behavior, args];
    this.thinktime = this.behaviors[behavior].thinktime;
  }
  this.thing_think = function(ev) {
    if (this.activebehavior && this.behaviors[this.activebehavior[0]]) {
      this.behaviors[this.activebehavior[0]].func.call(this);
    } else {
      // nothing to think about...
      //this.engine.systems.get('ai').remove(this);
    }
  }
}, elation.engine.things.generic);

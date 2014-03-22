{set var="page.title"}Elation Engine Test{/set}

{dependency name="utils.dust"}
{dependency name="utils.template"}

<script type="text/javascript">
elation.require("engine.engine", function() {
  elation.engine.create("test", ["physics", "render", "controls", "sound", "ai", "world", "admin"], function(engine) {
    //engine.systems.world.load({jsonencode var=$sector});
    engine.start();
    var foo = elation.engine.systems.render.view("main", elation.html.create({ tag: 'div', append: document.body }), { fullsize: 1, picking: 1, engine: 'test' } );
  });
});
</script>

{*<div elation:component="engine.systems.render.view" elation:name="main" elation:args.engine="test" elation:args.fullsize=1 elation:args.picking=1></div>*}


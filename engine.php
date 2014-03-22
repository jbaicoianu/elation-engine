<?php

class Component_engine extends Component {
  public function init() {
  }

  public function controller_engine($args) {
    $vars = array();
    return $this->GetComponentResponse("./engine.tpl", $vars);
  }
}  

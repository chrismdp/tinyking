import { connect } from "react-redux";

import { Game } from "components/game";
import { generate } from "features/map_slice";

const mapStateToProps = state => ({
  map: state.landscape,
  seed: state.seed,
  width: state.pointWidth,
  height: state.pointHeight,
});

const mapDispatchToProps = dispatch => ({
  changeSeed: seed => dispatch(generate({ seed }))
});

export default connect(mapStateToProps, mapDispatchToProps)(Game);

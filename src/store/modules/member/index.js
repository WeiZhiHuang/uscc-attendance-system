import mutations from "./mutations";
import * as actions from "./actions";

export const member = {
  namespaced: true,
  state: {
    members: []
  },
  mutations,
  actions
};

import { createSlice } from "@reduxjs/toolkit";

// State for the Build view: saved sessions, currently loaded artifact, model
// choice, and the model registry fetched from the agent service.
//
// Kept separate from chatSlice because Build sessions and chat conversations
// have different shapes and different persistence models. Sharing state
// between them would force awkward if-checks all over the UI.
const builderSlice = createSlice({
  name: "builder",
  initialState: {
    // List rows shown in the sidebar. Comes from GET /chat/builds without the
    // heavy `files` field (see backend controller for why).
    builds: [],
    // Currently loaded build in the IDE. `null` = new/empty state.
    activeBuildId: null,
    // In-memory cache of full builds (with files) keyed by _id. Populated as
    // the user clicks around so we don't refetch. Purged on delete.
    buildsById: {},
    // Curated model list from GET /agent/models. Fetched once on mount.
    models: [],
    // Which model to use for the next generation. "auto" uses the fallback
    // chain, anything else forces a specific model.
    selectedModel: "auto",
  },
  reducers: {
    setBuilds: (state, action) => {
      state.builds = action.payload;
    },
    // Called after a fresh generation. Prepends so newest is on top, and
    // sets it active so the IDE loads the just-generated artifact.
    addBuild: (state, action) => {
      const build = action.payload;
      // If it already exists (duplicate save race), replace in-place.
      const idx = state.builds.findIndex((b) => b._id === build._id);
      if (idx >= 0) state.builds[idx] = { ...state.builds[idx], ...build };
      else state.builds.unshift(build);
      state.activeBuildId = build._id;
      if (build.files) state.buildsById[build._id] = build;
    },
    removeBuild: (state, action) => {
      const id = action.payload;
      state.builds = state.builds.filter((b) => b._id !== id);
      if (state.activeBuildId === id) state.activeBuildId = null;
      delete state.buildsById[id];
    },
    setActiveBuildId: (state, action) => {
      state.activeBuildId = action.payload;
    },
    // Cache a fully hydrated build (with files). Called after GET /builds/:id.
    cacheBuild: (state, action) => {
      const build = action.payload;
      if (build?._id) state.buildsById[build._id] = build;
    },
    setModels: (state, action) => {
      state.models = action.payload;
    },
    setSelectedModel: (state, action) => {
      state.selectedModel = action.payload;
    },
  },
});

export const {
  setBuilds,
  addBuild,
  removeBuild,
  setActiveBuildId,
  cacheBuild,
  setModels,
  setSelectedModel,
} = builderSlice.actions;

export default builderSlice.reducer;

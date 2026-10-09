import type { ChunkMetaData } from "../types.js";
import { ContentTypes } from "../types.js";

export const buildManifest = (
  layerChunks: ChunkMetaData[],
  config: ChunkMetaData,
) => ({
  config: {
    ...config,
    mediaType: ContentTypes.APPLICATION_CONFIG,
  },
  layers: layerChunks.map((layerChunk) => ({
    ...layerChunk,
    mediaType: ContentTypes.APPLICATION_LAYER,
  })),
  schemaVersion: 2,
  mediaType: ContentTypes.APPLICATION_MANIFEST,
});

import {
  SiglipVisionModel,
  AutoProcessor,
  RawImage,
} from "@huggingface/transformers";

const model_id = "Marqo/marqo-fashionSigLIP";

let processor: AutoProcessor | null = null;
let visionModel: SiglipVisionModel | null = null;

async function loadModel() {
  if (!processor || !visionModel) {
    processor = await AutoProcessor.from_pretrained(model_id);
    visionModel = await SiglipVisionModel.from_pretrained(model_id);
  }
}

export async function getImageEmbedding(imagePath: string): Promise<number[]> {
  await loadModel();

  const image = await RawImage.read(imagePath);

  const inputs = await (processor as any)(image);

  const { image_embeds } = await visionModel!(inputs);

  return image_embeds.normalize().tolist()[0];
}
/**
 * Procedural combat VFX.
 *
 * Ported from the Elemental Sandbox (achrefelouafi/LinearAbilityExtThreeJS): a
 * set of skillshot abilities built entirely from geometry and shader code, with
 * no texture, model or HDRI dependency of their own. That is what makes them
 * portable -- an ability is a file and a settings block, not an asset bundle.
 */

export * from "./core/Layers";
export * from "./core/FrameUniforms";
export * from "./utils/math";
export * from "./utils/color";
export * from "./utils/ObjectPool";

export * from "./config/settings";
export * from "./effects/LightPool";
export * from "./effects/ScreenFlash";
export * from "./effects/CameraShake";
export * from "./particles/ParticleSystem";
export * from "./particles/ParticleEngine";
export * from "./geometry/ProceduralGeometry";
export * from "./effects/BurstSphere";
export * from "./effects/GroundDecals";
export * from "./core/Environment";
export * from "./materials/AbyssFieldMaterial";
export * from "./materials/ArcaneRibbonMaterial";
export * from "./materials/BodyArcMaterial";
export * from "./materials/ChargeFieldMaterial";
export * from "./materials/CinderFieldMaterial";
export * from "./materials/DarkFieldMaterial";
export * from "./materials/ElectricalSphereMaterial";
export * from "./materials/EmberFieldMaterial";
export * from "./materials/EmberOrbMaterial";
export * from "./materials/FireBodyMaterial";
export * from "./materials/FresnelAura";
export * from "./materials/GlassMaterial";
export * from "./materials/KrakenMaterial";
export * from "./materials/PyreMaterial";
export * from "./materials/RadialBoltMaterial";
export * from "./materials/RockMaterial";

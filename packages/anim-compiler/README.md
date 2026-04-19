# @blud/anim-compiler

Semantic validation and compilation of authoring documents into runtime-oriented graphs.

```ts
import { compileAnimationEditorDocument } from "@blud/anim-compiler";

const result = compileAnimationEditorDocument(document);
if (!result.ok) console.error(result.diagnostics);
```

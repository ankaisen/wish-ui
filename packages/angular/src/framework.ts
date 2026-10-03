import type { Framework } from "@wishkit/core";

export const angular: Framework = {
  name: "Angular",
  extensions: [".ts"],
  guidance: `- Write standalone Angular components in TypeScript (.ts files), with an inline template and inline styles. Don't use templateUrl or styleUrl: there are no separate files.
- Components are compiled in the browser by Angular's JIT compiler, so get dependencies with inject() rather than constructor parameters, and declare inputs and outputs with the @Input() and @Output() decorators rather than input() and output().
- Add the components a template uses to the component's imports array.
- Use signals and the built-in control flow (@if, @for, @switch).
- The entry file's default export is what the app renders. Keep it a standalone component class.`,
};

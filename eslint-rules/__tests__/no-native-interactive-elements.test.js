import { RuleTester } from "eslint";
import rule from "../no-native-interactive-elements.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

ruleTester.run("no-native-interactive-elements", rule, {
  valid: [
    { code: "const x = <Button onPress={() => {}}>Click</Button>;" },
    { code: "const x = <Input value='' onChange={() => {}} />;" },
    { code: "const x = <Select aria-label='Theme' />;" },
    { code: "const x = <TextArea />;" },
    { code: "const x = <Modal isOpen onOpenChange={() => {}} />;" },
    { code: "const x = <div><span>text</span></div>;" },
    { code: "const x = <label htmlFor='x'>Name</label>;" },
  ],
  invalid: [
    {
      code: "const x = <button onClick={() => {}}>Click</button>;",
      errors: [{ messageId: "banned" }],
    },
    {
      code: "const x = <input type='text' />;",
      errors: [{ messageId: "banned" }],
    },
    {
      code: "const x = <textarea />;",
      errors: [{ messageId: "banned" }],
    },
    {
      code: "const x = <select><option>A</option></select>;",
      errors: [{ messageId: "banned" }],
    },
    {
      code: "const x = <dialog>Body</dialog>;",
      errors: [{ messageId: "banned" }],
    },
    {
      code: "const x = <div><button>Nested</button></div>;",
      errors: [{ messageId: "banned" }],
    },
  ],
});

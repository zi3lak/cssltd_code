import { CssltdcodeMarkdown } from "../config/markdown"

export namespace CssltdcodeInstruction {
  export function content(text: string, item: string, options: CssltdcodeMarkdown.Options) {
    return CssltdcodeMarkdown.substitute(text, item, options)
  }

  export async function read(item: string, options: CssltdcodeMarkdown.Options) {
    return content(await CssltdcodeMarkdown.read(item, options), item, options)
  }
}

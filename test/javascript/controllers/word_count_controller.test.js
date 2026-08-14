import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { Application, Controller } from "@hotwired/stimulus";
import WordCountController from "../../../app/javascript/controllers/word_count_controller";

const application = Application.start();
application.register("word-count", WordCountController);

describe("word_count_controller", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    container.innerHTML = `
      <div data-controller="word-count">
        <span data-word-count-target="wordCount"></span>
        <span data-word-count-target="charCount"></span>
      </div>
      <ul data-chapter-panel-target="list">
        <li data-chapter-id="1"><span class="chapter-word-count"></span></li>
      </ul>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("updates counters via editor:contentChanged", () => {
    const el = container.querySelector("[data-controller=word-count]");
    const wordCount = el.querySelector("[data-word-count-target=wordCount]");
    const charCount = el.querySelector("[data-word-count-target=charCount]");

    el.dispatchEvent(
      new CustomEvent("editor:contentChanged", {
        detail: { wordCount: 4, text: "uma frase de exemplo" },
        bubbles: true,
      }),
    );

    expect(wordCount.textContent).toBe("4 palavras");
    expect(charCount.textContent).toBe("20 caracteres");
  });

  test("updates the active chapter counter in the sidebar", () => {
    const el = container.querySelector("[data-controller=word-count]");
    const sidebarItem = container.querySelector("li[data-chapter-id='1'] .chapter-word-count");

    el.editorController = { chapterIdValue: 1 };
    el.dispatchEvent(
      new CustomEvent("editor:contentChanged", {
        detail: { wordCount: 3, text: "três palavras" },
        bubbles: true,
      }),
    );

    expect(sidebarItem.textContent).toBe("3 pal.");
  });

  test("uses editor:chapterChanged to update from the editor", () => {
    const el = container.querySelector("[data-controller=word-count]");
    const wordCount = el.querySelector("[data-word-count-target=wordCount]");
    const charCount = el.querySelector("[data-word-count-target=charCount]");

    el.editorController = {
      editor: { getText: () => "novo conteúdo" },
    };

    el.dispatchEvent(new CustomEvent("editor:chapterChanged", { bubbles: true }));

    expect(wordCount.textContent).toBe("2 palavras");
    expect(charCount.textContent).toBe("13 caracteres");
  });
});

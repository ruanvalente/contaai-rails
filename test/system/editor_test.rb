require "application_system_test_case"

class EditorTest < ApplicationSystemTestCase
  setup do
    @author = users(:author)
    @book = books(:draft_book)
  end

  def editor_controller_js(script)
    page.execute_script(<<~JS)
      (function() {
        const app = window.Stimulus
        const el = document.querySelector('[data-controller~="editor"]')
        const ctrl = app.getControllerForElementAndIdentifier(el, "editor")
        #{script}
      })()
    JS
  end

  def editor_html
    page.evaluate_script(<<~JS)
      document.querySelector('[data-editor-target="content"]')?.innerHTML || ""
    JS
  end

  def set_editor_content(text)
    editor_controller_js(<<~JS)
      ctrl.editor.chain().focus().clearContent().insertContent(#{text.to_json}).run()
    JS
  end

  test "editor loads the first chapter and the counts" do
    login_as @author
    visit write_book_path(@book)

    assert_selector "h1", text: "Livro Rascunho"
    assert_text "Capítulo Um"

    within "[data-word-count-target=wordCount]" do
      assert_text "2 palavras"
    end
    within "[data-word-count-target=charCount]" do
      assert_text "11 caracteres"
    end
  end

  test "bold formatting applies tags to content" do
    login_as @author
    visit write_book_path(@book)

    editor_controller_js("ctrl.editor.chain().focus().selectAll().toggleBold().run()")

    assert editor_html.include?("<strong>"), "esperava <strong> no conteúdo: #{editor_html}"
  end

  test "typing updates the word count in real time" do
    login_as @author
    visit write_book_path(@book)

    set_editor_content("Texto de exemplo longo")

    within "[data-word-count-target=wordCount]" do
      assert_text "4 palavras"
    end
  end

  test "auto-save persists content to the server" do
    login_as @author
    visit write_book_path(@book)

    set_editor_content("Conteúdo salvo automaticamente")

    page.execute_script(<<~JS)
      (async function() {
        const app = window.Stimulus
        const el = document.querySelector('[data-controller~="auto-save"]')
        await app.getControllerForElementAndIdentifier(el, "auto-save").save({ flush: true })
        return true
      })()
    JS

    assert_text "Salvo automaticamente"

    visit write_book_path(@book)
    assert editor_html.include?("Conteúdo salvo automaticamente"),
      "conteúdo deveria persistir após auto-save e recarga"
  end

  test "adding a chapter from the sidebar creates and selects the new chapter" do
    login_as @author
    visit write_book_path(@book)

    click_on "Novo"

    assert_selector "li[data-chapter-id]", count: 3
    assert_text "Capítulo 3"
  end

  test "switching chapters loads the correct content" do
    login_as @author
    visit write_book_path(@book)

    all("li[data-chapter-id]").last.click

    assert_text "Segundo capítulo"
    assert editor_html.include?("Segundo capítulo"),
      "esperava o conteúdo do segundo capítulo após a troca"
  end

  test "publishing a book through the modal completes the publication" do
    login_as @author
    visit write_book_path(@book)

    click_on "Publicar"

    within "[data-publish-target=modal]" do
      assert_selector "[data-publish-target=titleCheck] .text-success"
      assert_selector "[data-publish-target=chapterCheck] .text-success"
      assert_selector "[data-publish-target=categoryCheck] .text-success"
      click_on "Publicar"
    end

    assert_selector "form[action*='unpublish']"
    assert @book.reload.published?
    assert_not_nil @book.published_at
  end
end

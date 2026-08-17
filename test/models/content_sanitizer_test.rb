require "test_helper"

class ContentSanitizerTest < ActiveSupport::TestCase
  # --- Tag filtering ---

  test "strips <script> tags" do
    html = '<script>alert("xss")</script><p>safe</p>'
    result = ContentSanitizer.sanitize(html)
    refute_match(/<script/i, result)
    assert_includes result, "<p>safe</p>"
  end

  test "strips <iframe> tags" do
    html = '<iframe src="evil.com"></iframe><p>text</p>'
    result = ContentSanitizer.sanitize(html)
    refute_match(/<iframe/i, result)
  end

  test "strips <object> tags" do
    html = '<object data="evil.swf"></object><p>text</p>'
    result = ContentSanitizer.sanitize(html)
    refute_match(/<object/i, result)
  end

  test "strips <embed> tags" do
    html = '<embed src="evil.swf"><p>text</p>'
    result = ContentSanitizer.sanitize(html)
    refute_match(/<embed/i, result)
  end

  test "strips onerror attribute from img" do
    html = '<img src="x" onerror="alert(1)"><p>text</p>'
    result = ContentSanitizer.sanitize(html)
    refute_match(/onerror/i, result)
  end

  test "strips onclick attribute" do
    html = '<div onclick="alert(1)">text</div>'
    result = ContentSanitizer.sanitize(html)
    refute_match(/onclick/i, result)
  end

  # --- Allowed tags ---

  test "preserves allowed block tags" do
    html = "<h1>H1</h1><h2>H2</h2><h3>H3</h3><h4>H4</h4><h5>H5</h5><h6>H6</h6>"
    result = ContentSanitizer.sanitize(html)
    assert_includes result, "<h1>H1</h1>"
    assert_includes result, "<h2>H2</h2>"
    assert_includes result, "<h3>H3</h3>"
    assert_includes result, "<h4>H4</h4>"
    assert_includes result, "<h5>H5</h5>"
    assert_includes result, "<h6>H6</h6>"
  end

  test "preserves inline tags" do
    html = "<p><strong>bold</strong> <em>italic</em> <u>underline</u> <s>strike</s></p>"
    result = ContentSanitizer.sanitize(html)
    assert_includes result, "<strong>bold</strong>"
    assert_includes result, "<em>italic</em>"
    assert_includes result, "<u>underline</u>"
    assert_includes result, "<s>strike</s>"
  end

  test "preserves list tags" do
    html = "<ul><li>item 1</li><li>item 2</li></ul><ol><li>ordered</li></ol>"
    result = ContentSanitizer.sanitize(html)
    assert_includes result, "<ul>"
    assert_includes result, "<ol>"
    assert_includes result, "<li>item 1</li>"
  end

  test "preserves blockquote" do
    html = "<blockquote><p>citação</p></blockquote>"
    result = ContentSanitizer.sanitize(html)
    assert_includes result, "<blockquote>"
  end

  test "preserves code and pre" do
    html = "<pre><code>console.log('hi')</code></pre>"
    result = ContentSanitizer.sanitize(html)
    assert_includes result, "<pre>"
    assert_includes result, "<code>"
  end

  test "preserves hr and br" do
    html = "<p>linha 1<br>linha 2<hr>linha 3</p>"
    result = ContentSanitizer.sanitize(html)
    assert_includes result, "<br>"
    assert_includes result, "<hr>"
  end

  # --- Allowed attributes ---

  test "preserves href on links" do
    html = '<a href="https://example.com" rel="nofollow" target="_blank">link</a>'
    result = ContentSanitizer.sanitize(html)
    assert_includes result, 'href="https://example.com"'
    assert_includes result, 'rel="nofollow"'
    assert_includes result, 'target="_blank"'
  end

  test "strips javascript: URLs from links" do
    html = '<a href="javascript:alert(1)">click</a>'
    result = ContentSanitizer.sanitize(html)
    refute_match(/javascript:/i, result)
  end

  test "strips event handler attributes" do
    html = '<a href="https://x.com" onmouseover="alert(1)">link</a>'
    result = ContentSanitizer.sanitize(html)
    refute_match(/onmouseover/i, result)
    assert_includes result, 'href="https://x.com"'
  end

  # --- Edge cases ---

  test "returns nil for nil input" do
    assert_nil ContentSanitizer.sanitize(nil)
  end

  test "returns blank string for empty input" do
    assert_equal "", ContentSanitizer.sanitize("")
  end

  test "returns blank string for whitespace-only input" do
    assert_equal "   ", ContentSanitizer.sanitize("   ")
  end

  test "handles nested tags" do
    html = "<p><strong><em>nested</em></strong></p>"
    result = ContentSanitizer.sanitize(html)
    assert_includes result, "<strong><em>nested</em></strong>"
  end

  test "handles mixed allowed and disallowed tags" do
    html = "<p>text</p><script>evil</script><strong>safe</strong>"
    result = ContentSanitizer.sanitize(html)
    assert_includes result, "<p>text</p>"
    refute_match(/<script/i, result)
    assert_includes result, "<strong>safe</strong>"
  end

  test "strips style attribute" do
    html = '<p style="color:red">text</p>'
    result = ContentSanitizer.sanitize(html)
    refute_match(/style=/i, result)
  end

  test "preserves align attribute on headings" do
    html = '<h1 align="center">title</h1>'
    result = ContentSanitizer.sanitize(html)
    assert_includes result, 'align="center"'
  end
end

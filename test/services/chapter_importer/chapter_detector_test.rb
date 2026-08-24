# frozen_string_literal: true

require "test_helper"

module ChapterImporter
  class ChapterDetectorTest < ActiveSupport::TestCase
    test "detects basic chapters" do
      text = <<~TEXT
        Capítulo 1
        A chegada

        Era uma noite escura.

        Capítulo 2
        A descoberta

        João caminhou pela floresta.
      TEXT

      chapters = ChapterDetector.detect(text)

      assert_equal 2, chapters.size
      assert_equal "Capítulo 1 — A chegada", chapters[0].title
      assert_equal "<p>Era uma noite escura.</p>", chapters[0].content
      assert_equal "Capítulo 2 — A descoberta", chapters[1].title
      assert_equal "<p>João caminhou pela floresta.</p>", chapters[1].content
    end

    test "high confidence for marked chapters" do
      chapters = ChapterDetector.detect("Capítulo 1\n\nConteúdo")

      assert_equal ChapterImporter::HIGH_CONFIDENCE, chapters.first.confidence
      refute chapters.first.needs_review?
    end

    test "detects uppercase markers" do
      chapters = ChapterDetector.detect("CAPÍTULO 1\n\nTexto")

      assert_equal "Capítulo 1", chapters.first.title
    end

    test "detects roman numerals case-insensitively" do
      upper = ChapterDetector.detect("CAPÍTULO IV\n\nTexto")
      lower = ChapterDetector.detect("capítulo ix\n\nTexto")

      assert_equal "Capítulo IV", upper.first.title
      assert_equal "Capítulo ix", lower.first.title
    end

    test "detects english chapter keyword" do
      chapters = ChapterDetector.detect("CHAPTER 12\n\nThe forest")

      assert_equal "Chapter 12", chapters.first.title
    end

    test "composes inline subtitle on same line" do
      chapters = ChapterDetector.detect("Capítulo 1 — A chegada\n\nEra uma noite.")

      assert_equal "Capítulo 1 — A chegada", chapters.first.title
      assert_equal "<p>Era uma noite.</p>", chapters.first.content
    end

    test "bare number becomes low confidence chapter needing review" do
      text = <<~TEXT
        1
        A chegada

        Era uma noite.
      TEXT

      chapters = ChapterDetector.detect(text)

      assert_equal "1 — A chegada", chapters.first.title
      assert_equal ChapterImporter::BARE_NUMBER_CONFIDENCE, chapters.first.confidence
      assert chapters.first.needs_review?
    end

    test "discards intro text before first chapter" do
      text = <<~TEXT
        Dedicação para minha mãe.

        Capítulo 1

        Conteúdo real.
      TEXT

      chapters = ChapterDetector.detect(text)

      assert_equal 1, chapters.size
      assert_no_match /Dedicação/, chapters.first.content
    end

    test "returns no chapters when file has no structure" do
      chapters = ChapterDetector.detect("Era uma vez um reino distante.")

      assert_empty chapters
    end

    test "detects chapter without content" do
      chapters = ChapterDetector.detect("Capítulo 1")

      assert_equal 1, chapters.size
      assert_equal "Capítulo 1", chapters.first.title
      assert_equal "", chapters.first.content
    end

    test "escapes html in content to prevent injection" do
      chapters = ChapterDetector.detect("Capítulo 1\n\n<script>alert('xss')</script>")

      assert_equal "<p>&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;</p>", chapters.first.content
    end

    test "groups consecutive lines into single paragraph and blank lines split paragraphs" do
      text = <<~TEXT
        Capítulo 1

        Primeira linha do parágrafo
        continua na mesma linha.

        Segundo parágrafo.
      TEXT

      content = ChapterDetector.detect(text).first.content

      assert_equal(
        "<p>Primeira linha do parágrafo continua na mesma linha.</p><p>Segundo parágrafo.</p>",
        content
      )
    end

    test "does not treat subtitle-looking sentence with punctuation as title" do
      text = <<~TEXT
        Capítulo 1

        A porta bateu. Ninguém abriu.
      TEXT

      chapter = ChapterDetector.detect(text).first

      assert_equal "Capítulo 1", chapter.title
      assert_match /A porta bateu/, chapter.content
    end
  end
end

# frozen_string_literal: true

require "test_helper"

module ChapterImporter
  class TextParserTest < ActiveSupport::TestCase
    FakeFile = Struct.new(:original_filename, :content, :size) do
      def read = content
    end

    def build_file(filename, content)
      FakeFile.new(filename, content, content.bytesize)
    end

    test "parses valid txt file" do
      text = TextParser.parse!(build_file("livro.txt", "Capítulo 1\n\nConteúdo"))

      assert_equal "Capítulo 1\n\nConteúdo", text
    end

    test "accepts md extension" do
      text = TextParser.parse!(build_file("livro.md", "# Título"))

      assert_equal "# Título", text
    end

    test "rejects unsupported extension" do
      error = assert_raises(Error) do
        TextParser.parse!(build_file("livro.pdf", "%PDF-1.4"))
      end

      assert_equal "Formato não suportado. Envie um arquivo .txt ou .md.", error.message
    end

    test "rejects empty file" do
      error = assert_raises(Error) do
        TextParser.parse!(build_file("livro.txt", "   \n  "))
      end

      assert_equal "O arquivo está vazio ou não contém texto legível.", error.message
    end

    test "rejects binary content with null bytes despite txt extension" do
      binary_content = "%PDF-1.4 \x00\x01\x02 fake pdf body"

      error = assert_raises(Error) do
        TextParser.parse!(build_file("documento.txt", binary_content))
      end

      assert_equal "O arquivo não parece ser um documento de texto legível.", error.message
    end

    test "rejects content with high density of control characters" do
      noisy_content = ("a\u0007b\u0007c\u0007d\u0007" * 50)

      error = assert_raises(Error) do
        TextParser.parse!(build_file("documento.txt", noisy_content))
      end

      assert_equal "O arquivo não parece ser um documento de texto legível.", error.message
    end

    test "rejects file above size limit" do
      big_content = "a" * (TextParser::MAX_FILE_SIZE + 1)

      error = assert_raises(Error) do
        TextParser.parse!(build_file("livro.txt", big_content))
      end

      assert_match /muito grande/, error.message
    end

    test "removes UTF-8 BOM" do
      text = TextParser.parse!(build_file("livro.txt", "\uFEFFCapítulo 1"))

      assert_equal "Capítulo 1", text
    end

    test "normalizes CRLF line endings" do
      text = TextParser.parse!(build_file("livro.txt", "linha um\r\nlinha dois\r\n"))

      assert_equal "linha um\nlinha dois\n", text
    end

    test "preserves accented characters" do
      text = TextParser.parse!(build_file("livro.txt", "Ação, coração, pingüim"))

      assert_equal "Ação, coração, pingüim", text
    end
  end
end

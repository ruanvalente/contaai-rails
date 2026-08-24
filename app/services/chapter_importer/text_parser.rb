# frozen_string_literal: true

module ChapterImporter
  class TextParser
    MAX_FILE_SIZE = 5.megabytes
    ALLOWED_EXTENSIONS = %w[.txt .md].freeze
    UTF8_BOM = "\uFEFF"
    CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/
    MAX_CONTROL_CHARACTER_RATIO = 0.05

    class << self
      def parse!(file)
        validate_presence!(file)
        validate_extension!(file)
        validate_size!(file)

        text = normalize(file.read)
        validate_content!(text)

        text
      end

      private

      def validate_presence!(file)
        return if file.respond_to?(:read) && file.size.to_i.positive?

        raise Error, "Selecione um arquivo para importar."
      end

      def validate_extension!(file)
        extension = File.extname(file.original_filename.to_s).downcase
        return if ALLOWED_EXTENSIONS.include?(extension)

        raise Error, "Formato não suportado. Envie um arquivo .txt ou .md."
      end

      def validate_size!(file)
        return if file.size <= MAX_FILE_SIZE

        raise Error, "Arquivo muito grande. O limite é #{MAX_FILE_SIZE / 1.megabyte} MB."
      end

      def normalize(raw)
        raw.dup
           .force_encoding(Encoding::UTF_8)
           .scrub
           .delete_prefix(UTF8_BOM)
           .gsub("\r\n", "\n")
           .gsub("\r", "\n")
      end

      def validate_content!(text)
        raise Error, "O arquivo não parece ser um documento de texto legível." if binary?(text)

        return if text.present? && text.strip.present?

        raise Error, "O arquivo está vazio ou não contém texto legível."
      end

      def binary?(text)
        return true if text.include?("\u0000")

        control_chars = text.scan(CONTROL_CHARACTERS).length
        control_chars.positive? && (control_chars.to_f / text.length) > MAX_CONTROL_CHARACTER_RATIO
      end
    end
  end
end

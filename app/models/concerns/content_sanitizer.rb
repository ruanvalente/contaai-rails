module ContentSanitizer
  extend ActiveSupport::Concern

  ALLOWED_TAGS = %w[
    h1 h2 h3 h4 h5 h6
    p strong em u s
    ul ol li
    blockquote
    a
    code pre
    hr br
  ].freeze

  ALLOWED_ATTRIBUTES = %w[
    href title target rel align
  ].freeze

  included do
    before_save :sanitize_content, if: :content_changed?
  end

  def self.sanitize(html)
    return html if html.blank?

    Rails::HTML5::SafeListSanitizer.new.sanitize(html, tags: ALLOWED_TAGS, attributes: ALLOWED_ATTRIBUTES)
  end

  private

  def sanitize_content
    self.content = ContentSanitizer.sanitize(content) if content.present?
  end
end
